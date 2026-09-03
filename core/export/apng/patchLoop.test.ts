import { describe, it, expect } from 'vitest'
import { upngBackend } from './upngBackend'
import { patchApngLoop, readApngLoopCount, actlCrcValid, crc32 } from './patchLoop'
import type { RenderFrame } from '../../types'

function frame(fill: number): RenderFrame {
  const rgba = new Uint8ClampedArray(8 * 8 * 4)
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = fill
    rgba[i + 3] = 255
  }
  return { rgba, width: 8, height: 8, delayMs: 100 }
}

describe('patchApngLoop', () => {
  it('crc32 matches the PNG reference value', () => {
    // CRC-32 of the ASCII string "IEND" is 0xAE426082 (every PNG ends with it).
    expect(crc32(new TextEncoder().encode('IEND'))).toBe(0xae426082)
  })

  it('upng writes an infinite loop; loop=false rewrites it to play once with a valid CRC', async () => {
    const png = await upngBackend.encode([frame(10), frame(200)], {
      width: 8,
      height: 8,
      loop: false,
    })
    expect(readApngLoopCount(png)).toBe(0)
    expect(actlCrcValid(png)).toBe(true)

    const once = patchApngLoop(png, false)
    expect(readApngLoopCount(once)).toBe(1)
    expect(actlCrcValid(once)).toBe(true)

    // idempotent + reversible
    expect(readApngLoopCount(patchApngLoop(once, false))).toBe(1)
    expect(readApngLoopCount(patchApngLoop(once, true))).toBe(0)
    expect(actlCrcValid(once)).toBe(true)
  })

  it('leaves a single-frame (non-animated) PNG untouched', async () => {
    const png = await upngBackend.encode([frame(10)], { width: 8, height: 8, loop: true })
    const before = png.slice()
    expect(readApngLoopCount(png)).toBeNull()
    patchApngLoop(png, false)
    expect(png).toEqual(before)
  })
})
