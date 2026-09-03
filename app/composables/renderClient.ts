import type { RenderJobRequest, RenderStage, TransferableFrame } from '#workers/protocol'
import type { FrameStats } from '#core/types'
import type { LayoutResult } from '#core/layout/types'
import { solveLayout } from '#core/layout/solve'
import { computeOvershoot } from '#core/animation/overshoot'
import { createSurface } from '#core/render/renderContext'
import { renderFrameSequence } from '#core/render/renderFrameSequence'
import { ensureFontFaces } from '#core/fonts/workerFonts'
import { yieldMacrotask } from '#core/util/yield'

/**
 * The one interface the preview and export talk to for rasterization. Two
 * implementations: the render worker (useRenderWorker) and this main-thread
 * fallback, used when the worker cannot match the preview's fonts (no
 * FontFaceSet in workers, `<link>`-loaded fonts) or has crashed repeatedly.
 */
export interface RenderHandlers {
  onBitmap?: (
    index: number,
    total: number,
    bitmap: ImageBitmap,
    delayMs: number,
    stats: FrameStats,
  ) => void
  onFrame?: (frame: TransferableFrame, stats: FrameStats) => void
  onProgress?: (stage: RenderStage, done: number, total: number) => void
}

export interface RenderResult {
  count: number
  layout: LayoutResult
  stats: FrameStats[]
}

export interface RenderJob {
  done: Promise<RenderResult>
  cancel: () => void
}

export interface RenderClient {
  kind: 'worker' | 'main'
  render(req: RenderJobRequest, handlers: RenderHandlers): RenderJob
}

export function createMainThreadRenderClient(): RenderClient {
  return {
    kind: 'main',
    render(req, h) {
      let cancelled = false
      const done = (async (): Promise<RenderResult> => {
        const { project, faces, output } = req
        if (faces.length) await ensureFontFaces(faces)
        const layout =
          req.layout ?? solveLayout(createSurface(64, 64).ctx, project, computeOvershoot(project))
        const stats: FrameStats[] = []
        let count = 0
        for await (const item of renderFrameSequence(project, layout, {
          shouldCancel: () => cancelled,
          yieldFn: yieldMacrotask,
        })) {
          stats.push(item.stats)
          count++
          const { frame } = item
          if (output === 'bitmap') {
            const bitmap = await createImageBitmap(
              new ImageData(frame.rgba, frame.width, frame.height),
            )
            if (cancelled) {
              bitmap.close()
              throw new Error('cancelled')
            }
            h.onBitmap?.(item.index, item.total, bitmap, frame.delayMs, item.stats)
          } else {
            h.onFrame?.(
              {
                index: item.index,
                rgba: frame.rgba.buffer,
                width: frame.width,
                height: frame.height,
                delayMs: frame.delayMs,
              },
              item.stats,
            )
          }
          h.onProgress?.('render', item.index + 1, item.total)
        }
        return { count, layout, stats }
      })()
      return {
        done,
        cancel: () => {
          cancelled = true
        },
      }
    },
  }
}
