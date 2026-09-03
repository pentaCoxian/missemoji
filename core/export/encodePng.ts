import UPNG from 'upng-js'
import type { EmojiEncoder, EncodeOptions, EncodedResult } from './types'
import type { RenderFrame } from '../types'

/**
 * Static PNG encoder. Uses UPNG.encode with cnum=0 (lossless 32-bit RGBA) on
 * the first frame. Works in any environment (no canvas needed for encoding).
 */
export const pngEncoder: EmojiEncoder = {
  format: 'png',
  supportsAnimation: false,
  async encode(frames: RenderFrame[], opts: EncodeOptions): Promise<EncodedResult> {
    const frame = frames[0]
    if (!frame) throw new Error('No frame to encode')
    opts.onProgress?.(0.2)

    // UPNG expects ArrayBuffers; pass the RGBA buffer for the single frame.
    const buf = frame.rgba.buffer.slice(
      frame.rgba.byteOffset,
      frame.rgba.byteOffset + frame.rgba.byteLength,
    ) as ArrayBuffer
    const out = UPNG.encode([buf], opts.width, opts.height, 0)
    opts.onProgress?.(1)

    const data = new Uint8Array(out)
    return { format: 'png', data, bytes: data.byteLength, mime: 'image/png' }
  },
}
