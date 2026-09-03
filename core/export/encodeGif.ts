import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import type { EmojiEncoder, EncodeOptions, EncodedResult } from './types'
import type { RenderFrame } from '../types'
import { optimizeFrames } from './optimizeFrames'

/**
 * GIF fallback encoder (spec §13) using gifenc. GIF is a fallback only — APNG
 * is the primary format. We threshold alpha to a 1-bit transparency mask
 * (GIF has no partial alpha), quantize each frame, and warn the caller about
 * quality loss elsewhere (sizeEstimate).
 */
const ALPHA_THRESHOLD = 128

export const gifEncoder: EmojiEncoder = {
  format: 'gif',
  supportsAnimation: true,
  async encode(frames: RenderFrame[], opts: EncodeOptions): Promise<EncodedResult> {
    if (frames.length === 0) throw new Error('No frames to encode')

    const { frames: optimized } = optimizeFrames(frames)
    const gif = GIFEncoder()
    const total = optimized.length

    for (let i = 0; i < total; i++) {
      if (opts.shouldCancel?.()) throw new Error('cancelled')
      const f = optimized[i]!.frame
      const rgba = new Uint8Array(f.rgba.buffer, f.rgba.byteOffset, f.rgba.byteLength)

      // Build a working copy; force fully-transparent pixels to a key color so
      // quantize keeps a transparent palette index.
      const work = rgba.slice()
      for (let p = 3; p < work.length; p += 4) {
        if (work[p]! < ALPHA_THRESHOLD) {
          work[p - 3] = 0
          work[p - 2] = 0
          work[p - 1] = 0
          work[p] = 0
        } else {
          work[p] = 255
        }
      }

      const palette = quantize(work, 256, { format: 'rgba4444' })
      const index = applyPalette(work, palette, 'rgba4444')

      // Find a transparent index (first palette entry with alpha 0), if any.
      let transparentIndex = -1
      for (let pi = 0; pi < palette.length; pi++) {
        if ((palette[pi]![3] ?? 255) === 0) {
          transparentIndex = pi
          break
        }
      }

      gif.writeFrame(index, f.width, f.height, {
        palette,
        delay: f.delayMs,
        transparent: transparentIndex >= 0,
        transparentIndex: transparentIndex >= 0 ? transparentIndex : undefined,
        dispose: 2,
        repeat: opts.loop ? 0 : -1,
      })
      opts.onProgress?.((i + 1) / total)
    }

    gif.finish()
    const data = gif.bytes()
    return { format: 'gif', data, bytes: data.byteLength, mime: 'image/gif' }
  },
}
