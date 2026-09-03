/**
 * APNG loop-count patching. upng-js always writes acTL `num_plays = 0`
 * (infinite) and has no option for it, so the loop flag is applied after
 * encoding by rewriting the acTL chunk in place and recomputing its CRC. Works
 * on any backend's output (idempotent); plain PNGs (no acTL) pass through.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

let table: Uint32Array | null = null
function crcTable(): Uint32Array {
  if (table) return table
  table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
}

/** Standard PNG CRC-32 over bytes[start, end). */
export function crc32(bytes: Uint8Array, start = 0, end = bytes.length): number {
  const t = crcTable()
  let c = 0xffffffff
  for (let i = start; i < end; i++) c = t[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function hasSignature(png: Uint8Array): boolean {
  if (png.length < 8) return false
  return PNG_SIGNATURE.every((b, i) => png[i] === b)
}

/** Find the acTL chunk; returns its data offset (after length + type) or -1. */
function findActl(png: Uint8Array): number {
  if (!hasSignature(png)) return -1
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength)
  let off = 8
  while (off + 12 <= png.length) {
    const len = dv.getUint32(off)
    const type = String.fromCharCode(png[off + 4]!, png[off + 5]!, png[off + 6]!, png[off + 7]!)
    if (type === 'acTL' && len === 8) return off + 8
    // acTL must precede the first IDAT; stop early on non-animated files.
    if (type === 'IDAT' || type === 'IEND') return -1
    off += 12 + len
  }
  return -1
}

/** Rewrite acTL num_plays (0 = infinite, 1 = play once) and fix the chunk CRC. */
export function patchApngLoop(png: Uint8Array, loop: boolean): Uint8Array {
  const dataOff = findActl(png)
  if (dataOff < 0) return png
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength)
  dv.setUint32(dataOff + 4, loop ? 0 : 1)
  // CRC covers chunk type + data.
  dv.setUint32(dataOff + 8, crc32(png, dataOff - 4, dataOff + 8))
  return png
}

/** Read acTL num_plays, or null for a non-animated PNG. */
export function readApngLoopCount(png: Uint8Array): number | null {
  const dataOff = findActl(png)
  if (dataOff < 0) return null
  return new DataView(png.buffer, png.byteOffset, png.byteLength).getUint32(dataOff + 4)
}

/** True when the acTL chunk's stored CRC matches its contents. */
export function actlCrcValid(png: Uint8Array): boolean {
  const dataOff = findActl(png)
  if (dataOff < 0) return false
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength)
  return dv.getUint32(dataOff + 8) === crc32(png, dataOff - 4, dataOff + 8)
}
