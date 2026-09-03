import type { EmojiEncoder, EncodeOptions, EncodedResult } from './types'
import type { RenderFrame } from '../types'
import { getApngBackend } from './apng/backend'
import { optimizeFrames } from './optimizeFrames'
import { patchApngLoop } from './apng/patchLoop'

/**
 * APNG encoder (spec §12). Runs the encoder-agnostic optimize pass (dedup +
 * delta meta) then delegates to the active ApngBackend (upng-js by default, the
 * Rust→WASM backend once enabled). For a single frame this still yields a valid
 * (non-animated) PNG.
 */
export const apngEncoder: EmojiEncoder = {
  format: 'apng',
  supportsAnimation: true,
  async encode(frames: RenderFrame[], opts: EncodeOptions): Promise<EncodedResult> {
    if (frames.length === 0) throw new Error('No frames to encode')
    opts.onProgress?.(0.1)

    const { frames: renderFrames } = optimizeFrames(frames)
    if (opts.shouldCancel?.()) throw new Error('cancelled')
    opts.onProgress?.(0.4)
    // 'size' optimize mode enables palette quantization for smaller files.
    const quantizeColors = opts.optimizeFor === 'size' ? 256 : 0

    const backend = opts.apngBackend ?? getApngBackend()
    const encoded = await backend.encode(renderFrames, {
      width: opts.width,
      height: opts.height,
      loop: opts.loop,
      quantizeColors,
    })
    // Backends differ in loop support (upng-js has none); normalise here.
    const data = patchApngLoop(encoded, opts.loop)
    opts.onProgress?.(1)

    return {
      format: 'apng',
      data,
      bytes: data.byteLength,
      mime: 'image/apng',
      framesEncoded: renderFrames.length,
    }
  },
}
