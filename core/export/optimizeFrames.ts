import type { RenderFrame } from '../types'
import { hashRGBA, framesEqual } from './frameStats'

/**
 * Encoder-agnostic frame optimization (spec §12 "Optimize frame data"):
 * consecutive identical frames are merged by summing their delays. This is
 * what makes hard blinks / holds cheap in every output format.
 */
export interface OptimizeResult {
  frames: RenderFrame[]
  /** how many duplicate frames were merged away */
  duplicatesMerged: number
}

export function optimizeFrames(frames: RenderFrame[]): OptimizeResult {
  const out: RenderFrame[] = []
  let duplicatesMerged = 0
  let lastHash = -1
  for (const f of frames) {
    const h = hashRGBA(f.rgba)
    const last = out[out.length - 1]
    if (last && h === lastHash && framesEqual(last.rgba, f.rgba)) {
      last.delayMs += f.delayMs
      duplicatesMerged++
      continue
    }
    out.push({ ...f })
    lastHash = h
  }
  return { frames: out, duplicatesMerged }
}
