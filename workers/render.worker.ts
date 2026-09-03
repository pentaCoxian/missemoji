/// <reference lib="webworker" />
/**
 * Render worker (spec §18). Owns an OffscreenCanvas (created inside the worker
 * via renderContext) and renders all animation frames off the main thread,
 * posting each frame's RGBA as a transferable ArrayBuffer. Also serves
 * analyze-bounds at export scale. Imports ONLY pure #core code.
 */
import type { RenderRequest, RenderResponse, TransferableFrame } from './protocol'
import type { EmojiProject } from '#core/project/schema'
import type { LayoutResult } from '#core/layout/types'
import { buildFramePlan } from '#core/animation/frames'
import { sampleFrameState } from '#core/animation/sampleAnimation'
import { renderProjectFrame } from '#core/render/renderProject'
import { createSurface } from '#core/render/renderContext'
import { placeText, paintPlacedText, withBlockStretch } from '#core/render/renderTextLayer'
import { getAlphaBounds } from '#core/layout/pixelBounds'

const cancelled = new Set<string>()

function post(msg: RenderResponse, transfer?: Transferable[]) {
  ;(self as DedicatedWorkerGlobalScope).postMessage(msg, transfer ?? [])
}

self.onmessage = (e: MessageEvent<RenderRequest>) => {
  const msg = e.data
  if (msg.type === 'cancel') {
    cancelled.add(msg.jobId)
    return
  }

  try {
    if (msg.type === 'render-frames') {
      renderFrames(msg.jobId, msg.project, msg.layout)
    } else if (msg.type === 'analyze-bounds') {
      analyzeBounds(msg.jobId, msg.project, msg.layout, msg.threshold)
    }
  } catch (err) {
    post({ type: 'error', jobId: msg.jobId, message: (err as Error).message })
  }
}

function renderFrames(jobId: string, project: EmojiProject, layout: LayoutResult) {
  const plan = buildFramePlan(project.animation)
  const total = plan.length

  for (let i = 0; i < total; i++) {
    if (cancelled.has(jobId)) {
      post({ type: 'cancelled', jobId })
      cancelled.delete(jobId)
      return
    }
    const step = plan[i]!
    const frameState = project.animation.enabled
      ? sampleFrameState(project.animation, step.progress)
      : undefined
    const rf = renderProjectFrame(project, {
      layout,
      frame: frameState,
      delayMs: step.delayMs,
    })

    // Copy the RGBA into a fresh ArrayBuffer we can transfer.
    const buf = rf.rgba.buffer.slice(
      rf.rgba.byteOffset,
      rf.rgba.byteOffset + rf.rgba.byteLength,
    ) as ArrayBuffer
    const frame: TransferableFrame = {
      index: i,
      rgba: buf,
      width: rf.width,
      height: rf.height,
      delayMs: rf.delayMs,
    }
    post({ type: 'frame', jobId, frame }, [buf])
    post({ type: 'progress', jobId, stage: 'render', done: i + 1, total })
  }

  post({ type: 'frames-done', jobId, count: total })
}

function analyzeBounds(
  jobId: string,
  project: EmojiProject,
  layout: LayoutResult,
  threshold: number,
) {
  const w = project.export.finalWidth
  const h = project.export.finalHeight
  const surface = createSurface(w, h)
  const placement = placeText(surface.ctx, project.font, project.layout, layout, 1, {
    x: 0,
    y: 0,
    w,
    h,
  })
  surface.ctx.fillStyle = '#ffffff'
  withBlockStretch(surface.ctx, placement, { x: 0, y: 0, w, h }, () =>
    paintPlacedText(surface.ctx, project.font, placement, 'fill'),
  )
  const img = surface.ctx.getImageData(0, 0, w, h)
  const bounds = getAlphaBounds(img.data, w, h, threshold)
  post({ type: 'bounds', jobId, bounds })
}
