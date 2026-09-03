/**
 * Minimal typed RPC over a dedicated Worker: one `hello` on boot (capabilities),
 * then jobs correlated by `jobId`. Handles the failure modes a naive
 * postMessage wrapper leaves hanging: worker crash (onerror / onmessageerror),
 * a worker that never boots, and a job that stalls (activity watchdog). On any
 * of those every in-flight job rejects with WorkerCrashedError and the worker
 * is respawned lazily on the next call.
 */

export class WorkerCrashedError extends Error {
  constructor(message = 'Worker crashed') {
    super(message)
    this.name = 'WorkerCrashedError'
  }
}

export type HandlerResult = 'continue' | 'done' | 'cancelled' | { error: string }

export interface RpcOptions<Req, Res, Hello> {
  create: () => Worker
  isHello: (m: Res) => boolean
  helloOf: (m: Res) => Hello
  jobIdOf: (m: Res) => string | undefined
  cancelMessage: (jobId: string) => Req
  helloTimeoutMs?: number
}

export interface RpcCall {
  done: Promise<void>
  cancel: () => void
}

export interface WorkerRpc<Req, Res, Hello> {
  /** Spawn (if needed) and resolve with the worker's capabilities. */
  ready(): Promise<Hello>
  call(
    req: Req,
    jobId: string,
    onMessage: (m: Res) => HandlerResult,
    opts?: { transfer?: Transferable[]; watchdogMs?: number },
  ): RpcCall
  terminate(): void
  crashCount(): number
  /** how many times a worker has been created (bumps after a crash) */
  spawnCount(): number
}

interface Pending<Res> {
  onMessage: (m: Res) => HandlerResult
  resolve: () => void
  reject: (err: Error) => void
  watchdog: ReturnType<typeof setTimeout> | null
  watchdogMs: number
}

export function createWorkerRpc<Req, Res, Hello>(
  options: RpcOptions<Req, Res, Hello>,
): WorkerRpc<Req, Res, Hello> {
  const helloTimeoutMs = options.helloTimeoutMs ?? 8000
  let worker: Worker | null = null
  let hello: Promise<Hello> | null = null
  let rejectHello: ((err: Error) => void) | null = null
  let crashes = 0
  let spawns = 0
  const pending = new Map<string, Pending<Res>>()

  function finish(jobId: string, err?: Error) {
    const p = pending.get(jobId)
    if (!p) return
    pending.delete(jobId)
    if (p.watchdog) clearTimeout(p.watchdog)
    if (err) p.reject(err)
    else p.resolve()
  }

  function crash(err: Error) {
    crashes++
    for (const id of [...pending.keys()]) finish(id, err)
    rejectHello?.(err)
    rejectHello = null
    worker?.terminate()
    worker = null
    hello = null
  }

  function arm(jobId: string) {
    const p = pending.get(jobId)
    if (!p) return
    if (p.watchdog) clearTimeout(p.watchdog)
    p.watchdog = setTimeout(
      () => crash(new WorkerCrashedError(`Worker stalled (no progress for ${p.watchdogMs} ms)`)),
      p.watchdogMs,
    )
  }

  function dispatch(m: Res) {
    const jobId = options.jobIdOf(m)
    if (!jobId) return
    const p = pending.get(jobId)
    if (!p) return
    arm(jobId)
    const r = p.onMessage(m)
    if (r === 'done') finish(jobId)
    else if (r === 'cancelled') finish(jobId, new Error('cancelled'))
    else if (typeof r === 'object') finish(jobId, new Error(r.error))
  }

  function spawn(): Promise<Hello> {
    if (worker && hello) return hello
    const w = options.create()
    worker = w
    spawns++
    hello = new Promise<Hello>((resolve, reject) => {
      const timer = setTimeout(() => {
        crash(new WorkerCrashedError('Worker did not start'))
      }, helloTimeoutMs)
      rejectHello = (err) => {
        clearTimeout(timer)
        reject(err)
      }
      w.onmessage = (e: MessageEvent<Res>) => {
        const m = e.data
        if (options.isHello(m)) {
          clearTimeout(timer)
          rejectHello = null
          resolve(options.helloOf(m))
          return
        }
        dispatch(m)
      }
      w.onerror = (e) => crash(new WorkerCrashedError(e.message || 'Worker error'))
      w.onmessageerror = () => crash(new WorkerCrashedError('Worker message could not be read'))
    })
    // a crashed boot is reported through ready()/call(); avoid an unhandled rejection
    hello.catch(() => undefined)
    return hello
  }

  return {
    ready: () => spawn(),
    call(req, jobId, onMessage, opts = {}) {
      const done = new Promise<void>((resolve, reject) => {
        pending.set(jobId, {
          onMessage,
          resolve,
          reject,
          watchdog: null,
          watchdogMs: opts.watchdogMs ?? 30000,
        })
        spawn()
          .then(() => {
            if (!pending.has(jobId) || !worker) return
            arm(jobId)
            worker.postMessage(req, opts.transfer ?? [])
          })
          .catch((err: Error) => finish(jobId, err))
      })
      return {
        done,
        cancel: () => {
          if (pending.has(jobId) && worker) worker.postMessage(options.cancelMessage(jobId))
        },
      }
    },
    terminate() {
      crash(new WorkerCrashedError('Worker terminated'))
      crashes-- // a deliberate terminate is not a crash
    },
    crashCount: () => crashes,
    spawnCount: () => spawns,
  }
}

let jobCounter = 0
export function nextJobId(prefix = 'job'): string {
  jobCounter += 1
  return `${prefix}_${jobCounter}`
}
