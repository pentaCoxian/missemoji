import { zipSync } from 'fflate'

export interface ZipEntry {
  name: string
  data: Uint8Array
}

/**
 * Bundle already-encoded files (PNG/APNG/GIF are compressed formats) into one
 * ZIP. Entries are stored, not deflated — recompressing them buys nothing.
 */
export function zipFiles(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const files: Record<string, Uint8Array> = {}
  for (const e of entries) files[e.name] = e.data
  const out = zipSync(files, { level: 0 })
  // fflate allocates plain ArrayBuffers; keep the precise type for Blob/transfer use
  return out.buffer instanceof ArrayBuffer ? (out as Uint8Array<ArrayBuffer>) : new Uint8Array(out)
}
