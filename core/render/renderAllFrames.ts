import type { EmojiProject } from '../project/schema'
import type { LayoutResult } from '../layout/types'
import type { RenderFrame } from '../types'
import { buildFramePlan } from '../animation/frames'
import { sampleFrameState } from '../animation/sampleAnimation'
import { renderProjectFrame } from './renderProject'

/**
 * Render every frame of a project for export (spec §12). For a static project
 * this is a single frame. Runs on the main thread or in a worker (both have a
 * canvas via renderContext). `shouldCancel` lets long renders bail.
 */
export function renderAllFrames(
  project: EmojiProject,
  layout: LayoutResult,
  opts: { shouldCancel?: () => boolean; onProgress?: (p: number) => void } = {},
): RenderFrame[] {
  const plan = buildFramePlan(project.animation)
  const frames: RenderFrame[] = []

  for (let i = 0; i < plan.length; i++) {
    if (opts.shouldCancel?.()) throw new Error('cancelled')
    const step = plan[i]!
    const frameState = project.animation.enabled
      ? sampleFrameState(project.animation, step.progress)
      : undefined
    const frame = renderProjectFrame(project, {
      layout,
      frame: frameState,
      delayMs: step.delayMs,
    })
    frames.push(frame)
    opts.onProgress?.((i + 1) / plan.length)
  }

  return frames
}
