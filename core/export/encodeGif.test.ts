import { describe, it, expect } from 'vitest'
import { gifEncoder } from './encodeGif'
import type { RenderFrame } from '../types'

function frame(rgb: [number, number, number], delayMs = 100): RenderFrame {
  const w = 16
  const h = 16
  const rgba = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      // left half opaque colour, right half transparent
      if (x < w / 2) {
        rgba[i] = rgb[0]
        rgba[i + 1] = rgb[1]
        rgba[i + 2] = rgb[2]
        rgba[i + 3] = 255
      }
    }
  }
  return { rgba, width: w, height: h, delayMs }
}

interface GifInfo {
  globalTable: boolean
  localTables: number
  images: number
  netscape: number
}

/** Minimal GIF block walker: counts image descriptors, local tables, NETSCAPE exts. */
function parseGif(d: Uint8Array): GifInfo {
  let p = 6
  const fields = d[p + 4]!
  p += 7
  const globalTable = (fields & 0x80) !== 0
  if (globalTable) p += 3 * 2 ** ((fields & 7) + 1)
  const info: GifInfo = { globalTable, localTables: 0, images: 0, netscape: 0 }
  const skipSubBlocks = () => {
    while (d[p]! !== 0) p += d[p]! + 1
    p++
  }
  while (p < d.length) {
    const b = d[p++]!
    if (b === 0x3b) break
    if (b === 0x21) {
      const label = d[p++]!
      if (label === 0xff) {
        const len = d[p]!
        const id = String.fromCharCode(...d.subarray(p + 1, p + 1 + len))
        if (id.startsWith('NETSCAPE')) info.netscape++
      }
      skipSubBlocks()
    } else if (b === 0x2c) {
      info.images++
      const f = d[p + 8]!
      p += 9
      if (f & 0x80) {
        info.localTables++
        p += 3 * 2 ** ((f & 7) + 1)
      }
      p++ // LZW min code size
      skipSubBlocks()
    } else {
      throw new Error(`unexpected block 0x${b.toString(16)} at ${p - 1}`)
    }
  }
  return info
}

describe('gifEncoder', () => {
  it('writes one global palette, no local tables, and a single NETSCAPE loop block', async () => {
    const res = await gifEncoder.encode(
      [frame([255, 0, 0]), frame([0, 0, 255]), frame([0, 255, 0])],
      {
        width: 16,
        height: 16,
        loop: true,
        optimizeFor: 'balanced',
      },
    )
    expect(String.fromCharCode(...res.data.slice(0, 6))).toBe('GIF89a')
    const info = parseGif(res.data)
    expect(info.images).toBe(3)
    expect(info.globalTable).toBe(true)
    expect(info.localTables).toBe(0)
    expect(info.netscape).toBe(1)
  })

  it('omits the NETSCAPE block when loop is off', async () => {
    const res = await gifEncoder.encode([frame([255, 0, 0]), frame([0, 0, 255])], {
      width: 16,
      height: 16,
      loop: false,
      optimizeFor: 'balanced',
    })
    expect(parseGif(res.data).netscape).toBe(0)
  })
})
