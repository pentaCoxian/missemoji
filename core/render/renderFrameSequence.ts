import type { EmojiProject } from '../project/schema'
import type { LayoutResult } from '../layout/types'
import type { FrameStats, RenderFrame } from '../types'
import { buildFramePlan } from '../animation/frames'
import { sampleFrameState } from '../animation/sampleAnimation'
import { renderProjectFrame } from './renderProject'
import { computeFrameStats } from '../export/frameStats'

export interface SequenceItem {
  index: number
  total: number
  frame: RenderFrame
  stats: FrameStats
}

export interface SequenceOptions {
  /** polled before each frame; throws Error('cancelled') when true */
  shouldCancel?: () => boolean
  /** awaited between frames so the host can process messages (see util/yield) */
  yieldFn?: () => Promise<void>
}

/**
 * Render a project's frames one at a time as an async sequence. This is the
 * single render path for BOTH the preview frame cache and export, in a worker
 * or on the main thread, so what you see is exactly what gets encoded.
 */
export async function* renderFrameSequence(
  project: EmojiProject,
  layout: LayoutResult,
  opts: SequenceOptions = {},
): AsyncGenerator<SequenceItem, void, void> {
  const plan = buildFramePlan(project.animation)
  const total = plan.length
  for (let i = 0; i < total; i++) {
    if (opts.shouldCancel?.()) throw new Error('cancelled')
    const step = plan[i]!
    const frameState = project.animation.enabled
      ? sampleFrameState(project.animation, step.progress)
      : undefined
    const frame = renderProjectFrame(project, { layout, frame: frameState, delayMs: step.delayMs })
    yield { index: i, total, frame, stats: computeFrameStats(frame) }
    if (i < total - 1 && opts.yieldFn) await opts.yieldFn()
  }
}
