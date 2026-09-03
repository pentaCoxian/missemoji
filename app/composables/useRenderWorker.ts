import type { RenderCaps, RenderRequest, RenderResponse } from '#workers/protocol'
import { hasOffscreenCanvas } from '#core/render/renderContext'
import { createWorkerRpc, nextJobId, type WorkerRpc } from '~/utils/workerRpc'
import {
  createMainThreadRenderClient,
  type RenderClient,
  type RenderResult,
} from '~/composables/renderClient'

/**
 * Lazily spawned, page-wide render worker plus the policy for when to use it.
 * The worker is created on the first render request, not at app mount.
 */
let rpc: WorkerRpc<RenderRequest, RenderResponse, RenderCaps> | null = null

export function getRenderRpc(): WorkerRpc<RenderRequest, RenderResponse, RenderCaps> {
  rpc ??= createWorkerRpc<RenderRequest, RenderResponse, RenderCaps>({
    create: () =>
      new Worker(new URL('#workers/render.worker.ts', import.meta.url), { type: 'module' }),
    isHello: (m) => m.type === 'hello',
    helloOf: (m) => (m as Extract<RenderResponse, { type: 'hello' }>).caps,
    jobIdOf: (m) => ('jobId' in m ? m.jobId : undefined),
    cancelMessage: (jobId) => ({ type: 'cancel', jobId }),
  })
  return rpc
}

export function createWorkerRenderClient(): RenderClient {
  return {
    kind: 'worker',
    render(req, h) {
      const jobId = nextJobId('render')
      let result: RenderResult | null = null
      const call = getRenderRpc().call(
        { type: 'render', jobId, ...req },
        jobId,
        (m) => {
          switch (m.type) {
            case 'progress':
              h.onProgress?.(m.stage, m.done, m.total)
              return 'continue'
            case 'bitmap':
              h.onBitmap?.(m.index, m.total, m.bitmap, m.delayMs, m.stats)
              return 'continue'
            case 'frame':
              h.onFrame?.(m.frame, m.stats)
              return 'continue'
            case 'done':
              result = { count: m.count, layout: m.layout, stats: m.stats }
              return 'done'
            case 'error':
              return { error: m.message }
            case 'cancelled':
              return 'cancelled'
            default:
              return 'continue'
          }
        },
        { watchdogMs: 60000 },
      )
      return {
        done: call.done.then(() => {
          if (!result) throw new Error('Render finished without a result')
          return result
        }),
        cancel: call.cancel,
      }
    },
  }
}

const mainClient = createMainThreadRenderClient()
const workerClient = createWorkerRenderClient()
let forcedMain = false

/**
 * Pick the renderer for a request. The worker is used only when it exists,
 * booted, can load fonts (when the project needs web fonts) and we actually
 * have face sources for it; otherwise the main-thread renderer keeps the
 * preview correct. After repeated crashes the main thread is used for good.
 */
export async function resolveRenderClient(
  needsFaces: boolean,
  hasFaces: boolean,
): Promise<RenderClient> {
  if (forcedMain) return mainClient
  if (typeof Worker === 'undefined' || !hasOffscreenCanvas()) return mainClient
  if (needsFaces && !hasFaces) return mainClient
  try {
    const caps = await getRenderRpc().ready()
    if (!caps.offscreenCanvas) return mainClient
    if (needsFaces && !caps.fonts) return mainClient
    return workerClient
  } catch {
    if (getRenderRpc().crashCount() >= 2) forcedMain = true
    return mainClient
  }
}

/** Called after a job failed with a crash: give up on the worker after 2. */
export function noteRenderWorkerCrash() {
  if (getRenderRpc().crashCount() >= 2) forcedMain = true
}
