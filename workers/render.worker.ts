/// <reference lib="webworker" />
/**
 * Render worker (spec §18). Loads the fonts it is handed into its own
 * FontFaceSet, renders every frame of a project off the main thread through
 * the shared frame sequence, and streams the results back either as
 * transferable ImageBitmaps (preview) or RGBA buffers (export). Jobs run one
 * at a time and yield between frames so a `cancel` can land mid-job.
 * Imports ONLY pure #core code.
 */
import type { RenderRequest, RenderResponse, RenderJobRequest } from './protocol'
import type { FrameStats } from '#core/types'
import type { LayoutResult } from '#core/layout/types'
import { solveLayout } from '#core/layout/solve'
import { computeOvershoot } from '#core/animation/overshoot'
import { renderFrameSequence } from '#core/render/renderFrameSequence'
import { createSurface, hasOffscreenCanvas, supportsCanvasFilter } from '#core/render/renderContext'
import { ensureFontFaces, workerFontsAvailable } from '#core/fonts/workerFonts'
import { yieldMacrotask } from '#core/util/yield'

const cancelled = new Set<string>()
let queue: Promise<void> = Promise.resolve()
let measureCtx: ReturnType<typeof createSurface>['ctx'] | null = null

function post(msg: RenderResponse, transfer?: Transferable[]) {
  ;(self as DedicatedWorkerGlobalScope).postMessage(msg, transfer ?? [])
}

function canvasFilterSupported(): boolean {
  try {
    return supportsCanvasFilter(createSurface(1, 1).ctx)
  } catch {
    return false
  }
}

post({
  type: 'hello',
  caps: {
    fonts: workerFontsAvailable(),
    offscreenCanvas: hasOffscreenCanvas(),
    canvasFilter: canvasFilterSupported(),
  },
})

self.onmessage = (e: MessageEvent<RenderRequest>) => {
  const msg = e.data
  if (msg.type === 'cancel') {
    cancelled.add(msg.jobId)
    return
  }
  // Sequential job queue; a failure in one job never blocks the next.
  queue = queue.then(() => handle(msg)).catch(() => undefined)
}

async function handle(msg: Exclude<RenderRequest, { type: 'cancel' }>) {
  const jobId = msg.jobId
  try {
    if (msg.type === 'load-fonts') {
      const r = await ensureFontFaces(msg.faces)
      post({ type: 'fonts-loaded', jobId, loaded: r.loaded, failed: r.failed })
    } else if (msg.type === 'render') {
      await render(jobId, msg)
    }
  } catch (err) {
    const message = (err as Error).message
    if (message === 'cancelled') post({ type: 'cancelled', jobId })
    else post({ type: 'error', jobId, message })
  } finally {
    cancelled.delete(jobId)
  }
}

async function render(jobId: string, req: RenderJobRequest) {
  const isCancelled = () => cancelled.has(jobId)
  const { project, faces, output } = req

  if (faces.length) {
    post({ type: 'progress', jobId, stage: 'fonts', done: 0, total: 1 })
    await ensureFontFaces(faces)
    post({ type: 'progress', jobId, stage: 'fonts', done: 1, total: 1 })
  }
  if (isCancelled()) throw new Error('cancelled')

  let layout: LayoutResult | null = req.layout
  if (!layout) {
    post({ type: 'progress', jobId, stage: 'layout', done: 0, total: 1 })
    measureCtx ??= createSurface(64, 64).ctx
    layout = solveLayout(measureCtx, project, computeOvershoot(project))
    post({ type: 'progress', jobId, stage: 'layout', done: 1, total: 1 })
  }

  const stats: FrameStats[] = []
  let count = 0
  for await (const item of renderFrameSequence(project, layout, {
    shouldCancel: isCancelled,
    yieldFn: yieldMacrotask,
  })) {
    stats.push(item.stats)
    count++
    const { frame } = item
    if (output === 'bitmap') {
      const bitmap = await createImageBitmap(new ImageData(frame.rgba, frame.width, frame.height))
      if (isCancelled()) {
        bitmap.close()
        throw new Error('cancelled')
      }
      post(
        {
          type: 'bitmap',
          jobId,
          index: item.index,
          total: item.total,
          bitmap,
          delayMs: frame.delayMs,
          stats: item.stats,
        },
        [bitmap],
      )
    } else {
      // getImageData hands us a fresh buffer: transfer it as-is (zero copy).
      const rgba = frame.rgba.buffer
      post(
        {
          type: 'frame',
          jobId,
          frame: {
            index: item.index,
            rgba,
            width: frame.width,
            height: frame.height,
            delayMs: frame.delayMs,
          },
          stats: item.stats,
        },
        [rgba],
      )
    }
    post({ type: 'progress', jobId, stage: 'render', done: item.index + 1, total: item.total })
  }

  post({ type: 'done', jobId, count, layout, stats })
}
