import type { RenderCaps, RenderRequest, RenderResponse } from '#workers/protocol'
import { hasOffscreenCanvas } from '#core/render/renderContext'
import { faceKey, type FontFaceSource } from '#core/fonts/fontSource'
import { createWorkerRpc, nextJobId, type RpcCall, type WorkerRpc } from '~/utils/workerRpc'
import {
  createMainThreadRenderClient,
  type RenderClient,
  type RenderResult,
} from '~/composables/renderClient'

/**
 * Lazily spawned, page-wide render worker plus the policy for when to use it.
 * The worker is created on the first render request, not at app mount.
 */
type RenderRpc = WorkerRpc<RenderRequest, RenderResponse, RenderCaps>
let rpc: RenderRpc | null = null

export function getRenderRpc(): RenderRpc {
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

/** Uploaded-font bytes already copied into the current worker instance. */
const sentCustom = new Set<string>()

/** Copy uploaded fonts (data faces) into the worker once per worker instance. */
async function pushCustomFaces(r: RenderRpc, faces: FontFaceSource[]) {
  await r.ready()
  const gen = r.spawnCount()
  const fresh = faces.filter((f) => f.data && !sentCustom.has(`${gen}:${faceKey(f)}`))
  if (fresh.length === 0) return
  const jobId = nextJobId('fonts')
  const call = r.call({ type: 'load-fonts', jobId, faces: fresh }, jobId, (m) => {
    if (m.type === 'fonts-loaded') return 'done'
    if (m.type === 'error') return { error: m.message }
    return 'continue'
  })
  await call.done
  for (const f of fresh) sentCustom.add(`${gen}:${faceKey(f)}`)
}

export function createWorkerRenderClient(): RenderClient {
  return {
    kind: 'worker',
    render(req, h) {
      const jobId = nextJobId('render')
      const r = getRenderRpc()
      let result: RenderResult | null = null
      let cancelled = false
      let call: RpcCall | null = null

      const handle = (m: RenderResponse) => {
        switch (m.type) {
          case 'progress':
            h.onProgress?.(m.stage, m.done, m.total)
            return 'continue' as const
          case 'bitmap':
            h.onBitmap?.(m.index, m.total, m.bitmap, m.delayMs, m.stats)
            return 'continue' as const
          case 'frame':
            h.onFrame?.(m.frame, m.stats)
            return 'continue' as const
          case 'done':
            result = { count: m.count, layout: m.layout, stats: m.stats }
            return 'done' as const
          case 'error':
            return { error: m.message }
          case 'cancelled':
            return 'cancelled' as const
          default:
            return 'continue' as const
        }
      }

      const done = (async (): Promise<RenderResult> => {
        await pushCustomFaces(r, req.faces)
        if (cancelled) throw new Error('cancelled')
        // the worker already holds uploaded-font bytes: send the faces without them
        const faces = req.faces.map((f) => (f.data ? { ...f, data: undefined } : f))
        call = r.call({ type: 'render', jobId, ...req, faces }, jobId, handle, {
          watchdogMs: 60000,
        })
        await call.done
        if (!result) throw new Error('Render finished without a result')
        return result
      })()

      return {
        done,
        cancel: () => {
          cancelled = true
          call?.cancel()
        },
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
