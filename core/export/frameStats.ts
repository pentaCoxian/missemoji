import type { FrameStats, RenderFrame } from '../types'

/** Fast 32-bit FNV-style hash of an RGBA buffer, sampling every 4th pixel. */
export function hashRGBA(rgba: Uint8ClampedArray): number {
  let h = 2166136261
  for (let i = 0; i < rgba.length; i += 16) {
    h ^= rgba[i]!
    h = Math.imul(h, 16777619)
  }
  // fold the length in so frames of different sizes never collide trivially
  h ^= rgba.length
  return h >>> 0
}

export function framesEqual(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/** Opaque-pixel count + content hash for a rendered frame. */
export function computeFrameStats(frame: RenderFrame): FrameStats {
  let opaquePixels = 0
  const d = frame.rgba
  for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) opaquePixels++
  return { opaquePixels, hash: hashRGBA(d) }
}
