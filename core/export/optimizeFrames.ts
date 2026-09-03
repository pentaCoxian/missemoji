import type { RenderFrame, Bounds } from '../types'

/**
 * Encoder-agnostic frame optimization (spec §12 "Optimize frame data"):
 *   1. Duplicate-frame removal: merge consecutive identical frames by summing
 *      their delays.
 *   2. Changed-region bounding box per frame (delta) for backends that can emit
 *      partial frames (APNG fcTL regions). Backends that can't ignore the meta.
 */

export interface OptimizedFrame {
  frame: RenderFrame
  /** changed region vs previous frame (full-frame for index 0) */
  dirtyRect: Bounds
}

export interface OptimizeResult {
  frames: OptimizedFrame[]
  /** how many duplicate frames were merged away */
  duplicatesMerged: number
}

/** Fast 32-bit rolling hash of an RGBA buffer for dup detection. */
function hashRGBA(rgba: Uint8ClampedArray): number {
  let h = 2166136261
  // sample every 4th pixel for speed; collisions are acceptable (we verify on hit)
  for (let i = 0; i < rgba.length; i += 16) {
    h ^= rgba[i]!
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function framesEqual(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/** Changed-pixel bounding box between two equal-size RGBA frames. */
function changedRect(
  prev: Uint8ClampedArray,
  cur: Uint8ClampedArray,
  width: number,
  height: number,
): Bounds {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    const row = y * width * 4
    for (let x = 0; x < width; x++) {
      const i = row + x * 4
      if (
        prev[i] !== cur[i] ||
        prev[i + 1] !== cur[i + 1] ||
        prev[i + 2] !== cur[i + 2] ||
        prev[i + 3] !== cur[i + 3]
      ) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  return { minX, minY, maxX: maxX + 1, maxY: maxY + 1 }
}

export function optimizeFrames(frames: RenderFrame[]): OptimizeResult {
  if (frames.length === 0) return { frames: [], duplicatesMerged: 0 }

  // 1. dedup consecutive identical frames.
  const deduped: RenderFrame[] = []
  let duplicatesMerged = 0
  let lastHash = NaN
  for (const f of frames) {
    const h = hashRGBA(f.rgba)
    const last = deduped[deduped.length - 1]
    if (last && h === lastHash && framesEqual(last.rgba, f.rgba)) {
      last.delayMs += f.delayMs
      duplicatesMerged++
      continue
    }
    deduped.push({ ...f })
    lastHash = h
  }

  // 2. compute dirty rects.
  const out: OptimizedFrame[] = deduped.map((frame, i) => {
    if (i === 0) {
      return {
        frame,
        dirtyRect: { minX: 0, minY: 0, maxX: frame.width, maxY: frame.height },
      }
    }
    const prev = deduped[i - 1]!
    return {
      frame,
      dirtyRect: changedRect(prev.rgba, frame.rgba, frame.width, frame.height),
    }
  })

  return { frames: out, duplicatesMerged }
}
