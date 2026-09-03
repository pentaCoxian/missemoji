import type { AnimationSpec } from '../project/schema'
import type { FramePlan } from '../types'

/** Frame-count bounds keep APNG size sane. */
export const MAX_FRAMES = 60

/**
 * Build the frame sampling plan from fps + duration (spec §12). For a static
 * (disabled) animation this returns a single frame. Per-frame delays are
 * distributed so they sum EXACTLY to the duration (no rounding drift), which
 * keeps the exported loop period identical to the preview's.
 */
export function buildFramePlan(anim: AnimationSpec): FramePlan[] {
  if (!anim.enabled) {
    return [{ frameIndex: 0, progress: 0, delayMs: 0 }]
  }

  const fps = Math.max(1, anim.fps)
  const duration = Math.max(100, Math.round(anim.durationMs))
  const frameCount = Math.max(1, Math.min(MAX_FRAMES, Math.round((fps * duration) / 1000)))

  const plan: FramePlan[] = []
  for (let i = 0; i < frameCount; i++) {
    const start = Math.round((i * duration) / frameCount)
    const end = Math.round(((i + 1) * duration) / frameCount)
    plan.push({
      frameIndex: i,
      progress: i / frameCount,
      delayMs: end - start,
    })
  }
  return plan
}
