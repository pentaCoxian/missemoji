import type { AnimationSpec } from '../project/schema'
import type { FramePlan } from '../types'

/**
 * Build the frame sampling plan from fps + duration (spec §12). For a static
 * (disabled) animation this returns a single frame. Frame count is clamped to a
 * sane range to bound APNG size.
 */
export function buildFramePlan(anim: AnimationSpec): FramePlan[] {
  if (!anim.enabled) {
    return [{ frameIndex: 0, progress: 0, delayMs: 0 }]
  }

  const fps = Math.max(1, anim.fps)
  const duration = Math.max(100, anim.durationMs)
  const frameCount = Math.max(1, Math.min(60, Math.round((fps * duration) / 1000)))
  const delayMs = Math.round(duration / frameCount)

  const plan: FramePlan[] = []
  for (let i = 0; i < frameCount; i++) {
    plan.push({
      frameIndex: i,
      progress: i / frameCount,
      delayMs,
    })
  }
  return plan
}
