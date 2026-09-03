import { onScopeDispose } from 'vue'
import type {
  RenderRequest,
  RenderResponse,
  EncodeRequest,
  EncodeResponse,
  EncodeRequestOpts,
  TransferableFrame,
} from '#workers/protocol'
import type { EmojiProject } from '#core/project/schema'
import type { LayoutResult } from '#core/layout/types'

/**
 * Typed RPC clients for the render and encode workers (spec §18). Workers are
 * created with the Vite idiom so they're code-split, and run as ES modules so
 * they can `import` from #core. The export flow: render worker -> frames ->
 * encode worker -> bytes, with progress + cancellation.
 */

let jobCounter = 0
function nextJobId() {
  jobCounter += 1
  return `job_${jobCounter}`
}

export interface ExportProgress {
  stage: 'render' | 'encode'
  fraction: number
}

export interface ExportViaWorkersResult {
  data: ArrayBuffer
  bytes: number
  mime: string
}

export function useWorkerClient() {
  const renderWorker = new Worker(
    new URL('#workers/render.worker.ts', import.meta.url),
    { type: 'module' },
  )
  const encodeWorker = new Worker(
    new URL('#workers/encode.worker.ts', import.meta.url),
    { type: 'module' },
  )

  let activeJobId: string | null = null

  function cancel() {
    if (!activeJobId) return
    renderWorker.postMessage({ type: 'cancel', jobId: activeJobId } as RenderRequest)
    encodeWorker.postMessage({ type: 'cancel', jobId: activeJobId } as EncodeRequest)
  }

  /** Render all frames in the render worker; resolves with transferable frames. */
  function renderFrames(
    jobId: string,
    project: EmojiProject,
    layout: LayoutResult,
    onProgress?: (p: ExportProgress) => void,
  ): Promise<TransferableFrame[]> {
    return new Promise((resolve, reject) => {
      const frames: TransferableFrame[] = []
      const handler = (e: MessageEvent<RenderResponse>) => {
        const m = e.data
        if (m.jobId !== jobId) return
        switch (m.type) {
          case 'frame':
            frames.push(m.frame)
            break
          case 'progress':
            onProgress?.({ stage: 'render', fraction: m.done / m.total })
            break
          case 'frames-done':
            renderWorker.removeEventListener('message', handler)
            resolve(frames)
            break
          case 'cancelled':
            renderWorker.removeEventListener('message', handler)
            reject(new Error('cancelled'))
            break
          case 'error':
            renderWorker.removeEventListener('message', handler)
            reject(new Error(m.message))
            break
        }
      }
      renderWorker.addEventListener('message', handler)
      renderWorker.postMessage(
        { type: 'render-frames', jobId, project, layout } as RenderRequest,
      )
    })
  }

  /** Encode the given frames in the encode worker; resolves with bytes. */
  function encodeFrames(
    jobId: string,
    frames: TransferableFrame[],
    opts: EncodeRequestOpts,
    onProgress?: (p: ExportProgress) => void,
  ): Promise<ExportViaWorkersResult> {
    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent<EncodeResponse>) => {
        const m = e.data
        if (m.jobId !== jobId) return
        switch (m.type) {
          case 'progress':
            onProgress?.({ stage: 'encode', fraction: m.done / m.total })
            break
          case 'result':
            encodeWorker.removeEventListener('message', handler)
            resolve({ data: m.data, bytes: m.bytes, mime: m.mime })
            break
          case 'cancelled':
            encodeWorker.removeEventListener('message', handler)
            reject(new Error('cancelled'))
            break
          case 'error':
            encodeWorker.removeEventListener('message', handler)
            reject(new Error(m.message))
            break
        }
      }
      encodeWorker.addEventListener('message', handler)
      // Transfer all frame buffers to the encode worker (zero-copy).
      const transfer = frames.map((f) => f.rgba)
      encodeWorker.postMessage(
        { type: 'encode', jobId, frames, opts } as EncodeRequest,
        transfer,
      )
    })
  }

  /** Full export: render -> encode, in workers, with progress + cancel. */
  async function exportViaWorkers(
    project: EmojiProject,
    layout: LayoutResult,
    opts: EncodeRequestOpts,
    onProgress?: (p: ExportProgress) => void,
  ): Promise<ExportViaWorkersResult> {
    const jobId = nextJobId()
    activeJobId = jobId
    try {
      const frames = await renderFrames(jobId, project, layout, (p) =>
        onProgress?.({ stage: 'render', fraction: p.fraction * 0.5 }),
      )
      const result = await encodeFrames(jobId, frames, opts, (p) =>
        onProgress?.({ stage: 'encode', fraction: 0.5 + p.fraction * 0.5 }),
      )
      return result
    } finally {
      if (activeJobId === jobId) activeJobId = null
    }
  }

  function terminate() {
    renderWorker.terminate()
    encodeWorker.terminate()
  }

  onScopeDispose(terminate)

  return { exportViaWorkers, cancel, terminate }
}
