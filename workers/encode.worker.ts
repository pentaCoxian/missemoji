/// <reference lib="webworker" />
/**
 * Encode worker (spec §18). Receives rendered frames (transferable ArrayBuffers)
 * and encodes them to the requested format via the encoder registry, posting
 * progress and returning the encoded bytes (transferable). Imports ONLY pure
 * #core code so the worker bundle excludes Vue/Pinia.
 */
import type { EncodeRequest, EncodeResponse, TransferableFrame } from './protocol'
import type { RenderFrame } from '#core/types'
import { getEncoder } from '#core/export/registry'
import { setApngBackend } from '#core/export/apng/backend'
import { upngBackend } from '#core/export/apng/upngBackend'
import { wasmApngBackend } from '#core/export/apng/wasmBackend'

const cancelled = new Set<string>()

function post(msg: EncodeResponse, transfer?: Transferable[]) {
  ;(self as DedicatedWorkerGlobalScope).postMessage(msg, transfer ?? [])
}

self.onmessage = async (e: MessageEvent<EncodeRequest>) => {
  const msg = e.data
  if (msg.type === 'cancel') {
    cancelled.add(msg.jobId)
    return
  }

  if (msg.type !== 'encode') return
  const { jobId, frames, opts } = msg

  // Select the APNG backend for this job (decision §5: swappable).
  if (opts.apngBackend === 'wasm') setApngBackend(wasmApngBackend)
  else setApngBackend(upngBackend)

  try {
    const renderFrames: RenderFrame[] = frames.map((f: TransferableFrame) => ({
      rgba: new Uint8ClampedArray(f.rgba),
      width: f.width,
      height: f.height,
      delayMs: f.delayMs,
    }))

    const encoder = getEncoder(opts.format)
    const result = await encoder.encode(renderFrames, {
      width: opts.width,
      height: opts.height,
      loop: opts.loop,
      optimizeFor: opts.optimizeFor,
      shouldCancel: () => cancelled.has(jobId),
      onProgress: (p) =>
        post({
          type: 'progress',
          jobId,
          stage: 'encode',
          done: Math.round(p * 100),
          total: 100,
        }),
    })

    if (cancelled.has(jobId)) {
      post({ type: 'cancelled', jobId })
      cancelled.delete(jobId)
      return
    }

    // Transfer the encoded bytes back to the main thread.
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
      },
      [data],
    )
  } catch (err) {
    if (cancelled.has(jobId)) {
      post({ type: 'cancelled', jobId })
      cancelled.delete(jobId)
    } else {
      post({ type: 'error', jobId, message: (err as Error).message })
    }
  }
}
