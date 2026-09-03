import type {
  EncodeRequest,
  EncodeRequestOpts,
  EncodeResponse,
  TransferableFrame,
} from '#workers/protocol'
import { createWorkerRpc, nextJobId, type WorkerRpc } from '~/utils/workerRpc'

export type EncodeResultMessage = Extract<EncodeResponse, { type: 'result' }>

let rpc: WorkerRpc<EncodeRequest, EncodeResponse, { wasmApng: boolean }> | null = null

/** Lazily spawned encode worker (first export). */
export function getEncodeRpc() {
  rpc ??= createWorkerRpc<EncodeRequest, EncodeResponse, { wasmApng: boolean }>({
    create: () =>
      new Worker(new URL('#workers/encode.worker.ts', import.meta.url), { type: 'module' }),
    isHello: (m) => m.type === 'hello',
    helloOf: (m) => (m as Extract<EncodeResponse, { type: 'hello' }>).caps,
    jobIdOf: (m) => ('jobId' in m ? m.jobId : undefined),
    cancelMessage: (jobId) => ({ type: 'cancel', jobId }),
    helloTimeoutMs: 15000, // the wasm build is instantiated before hello
  })
  return rpc
}

export function encodeInWorker(
  frames: TransferableFrame[],
  opts: EncodeRequestOpts,
  onProgress?: (fraction: number) => void,
): { done: Promise<EncodeResultMessage>; cancel: () => void } {
  const jobId = nextJobId('encode')
  let result: EncodeResultMessage | null = null
  const call = getEncodeRpc().call(
    { type: 'encode', jobId, frames, opts },
    jobId,
    (m) => {
      switch (m.type) {
        case 'progress':
          onProgress?.(m.total ? m.done / m.total : 0)
          return 'continue'
        case 'result':
          result = m
          return 'done'
        case 'error':
          return { error: m.message }
        case 'cancelled':
          return 'cancelled'
        default:
          return 'continue'
      }
    },
    { transfer: frames.map((f) => f.rgba), watchdogMs: 60000 },
  )
  return {
    done: call.done.then(() => {
      if (!result) throw new Error('Encode finished without a result')
      return result
    }),
    cancel: call.cancel,
  }
}
