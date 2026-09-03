import type { Bounds } from '../types'
import { EMPTY_BOUNDS } from '../types'

/**
 * Scan an RGBA buffer and return the bounding box of pixels whose alpha exceeds
 * `threshold` (spec §9). Used to (a) validate that a fitted layout's *visible*
 * pixels fit the safe box — decorative fonts overflow their metric box — and
 * (b) crop/center the final emoji. Returns EMPTY_BOUNDS if nothing is visible.
 */
export function getAlphaBounds(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 0,
): Bounds {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  // Walk rows; index into the alpha channel directly (offset 3).
  for (let y = 0; y < height; y++) {
    const rowStart = y * width * 4
    for (let x = 0; x < width; x++) {
      const a = rgba[rowStart + x * 4 + 3]!
      if (a > threshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < 0) return { ...EMPTY_BOUNDS }
  // maxX/maxY are last-visible pixel indices; make max exclusive.
  return { minX, minY, maxX: maxX + 1, maxY: maxY + 1 }
}
