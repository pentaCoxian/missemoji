/// <reference lib="webworker" />
/**
 * Encode worker (spec §18). Receives rendered frames (transferable ArrayBuffers)
 * and encodes them to the requested format via the encoder registry, posting
 * progress and returning the encoded bytes (transferable). Imports ONLY pure
 * #core code so the worker bundle excludes Vue/Pinia.
 */
import type { EncodeRequest, EncodeResponse, TransferableFrame } from './protocol'
import type { RenderFrame } from '#core/types'
import type { ApngBackend } from '#core/export/types'
import { getEncoder } from '#core/export/registry'
import { upngBackend } from '#core/export/apng/upngBackend'
import { wasmApngBackend, isWasmApngAvailable } from '#core/export/apng/wasmBackend'

const cancelled = new Set<string>()

function post(msg: EncodeResponse, transfer?: Transferable[]) {
  ;(self as DedicatedWorkerGlobalScope).postMessage(msg, transfer ?? [])
}

const wasmReady = isWasmApngAvailable()
void wasmReady.then((wasmApng) => post({ type: 'hello', caps: { wasmApng } }))

self.onmessage = async (e: MessageEvent<EncodeRequest>) => {
  const msg = e.data
  if (msg.type === 'cancel') {
    cancelled.add(msg.jobId)
    return
  }
  if (msg.type !== 'encode') return
  const { jobId, frames, opts } = msg

  try {
    const renderFrames: RenderFrame[] = frames.map((f: TransferableFrame) => ({
      rgba: new Uint8ClampedArray(f.rgba),
      width: f.width,
      height: f.height,
      delayMs: f.delayMs,
    }))

    const encoder = getEncoder(opts.format)
    const shouldCancel = () => cancelled.has(jobId)
    const onProgress = (p: number) =>
      post({ type: 'progress', jobId, stage: 'encode', done: Math.round(p * 100), total: 100 })

    // APNG backend choice; the wasm build may be missing or fail to load, in
    // which case upng-js (pure JS) takes over transparently.
    const wantWasm = opts.format === 'apng' && opts.apngBackend === 'wasm' && (await wasmReady)
    let backend: ApngBackend = wantWasm ? wasmApngBackend : upngBackend
    const encode = () =>
      encoder.encode(renderFrames, {
        width: opts.width,
        height: opts.height,
        loop: opts.loop,
        optimizeFor: opts.optimizeFor,
        apngBackend: backend,
        shouldCancel,
        onProgress,
      })
    let result
    try {
      result = await encode()
    } catch (err) {
      if (shouldCancel() || backend === upngBackend) throw err
      backend = upngBackend
      result = await encode()
    }

    if (cancelled.has(jobId)) {
      post({ type: 'cancelled', jobId })
      return
    }

    const data = result.data.buffer.slice(
      result.data.byteOffset,
      result.data.byteOffset + result.data.byteLength,
    ) as ArrayBuffer
    post(
      {
        type: 'result',
        jobId,
        format: result.format,
        bytes: result.bytes,
        mime: result.mime,
        data,
        backendUsed: opts.format === 'apng' ? backend.id : result.format,
        framesEncoded: result.framesEncoded ?? renderFrames.length,
      },
      [data],
    )
  } catch (err) {
    if (cancelled.has(jobId)) post({ type: 'cancelled', jobId })
    else post({ type: 'error', jobId, message: (err as Error).message })
  } finally {
    cancelled.delete(jobId)
  }
}
