import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import type { EmojiEncoder, EncodeOptions, EncodedResult } from './types'
import type { RenderFrame } from '../types'
import { optimizeFrames } from './optimizeFrames'

/**
 * GIF fallback encoder (spec §13) using gifenc. GIF is a fallback only — APNG
 * is the primary format. Alpha is thresholded to a 1-bit mask (GIF has no
 * partial alpha), ONE global palette is quantized from a sample of every
 * frame (smaller files, no colour shimmer between frames), and each frame is
 * indexed against it.
 */
const ALPHA_THRESHOLD = 128
/** cap on pixels fed to the quantizer (stride-sampled across all frames) */
const PALETTE_SAMPLE_PIXELS = 250_000

/** 1-bit alpha: transparent pixels become (0,0,0,0), everything else opaque. */
function thresholdAlpha(frame: RenderFrame): Uint8Array {
  const work = new Uint8Array(
    frame.rgba.buffer,
    frame.rgba.byteOffset,
    frame.rgba.byteLength,
  ).slice()
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
  return work
}

/** Build a shared palette from a stride sample of all (thresholded) frames. */
function globalPalette(frames: Uint8Array[]): { palette: number[][]; transparentIndex: number } {
  const totalPixels = frames.reduce((n, f) => n + f.length / 4, 0)
  const stride = Math.max(1, Math.ceil(totalPixels / PALETTE_SAMPLE_PIXELS))
  const sample = new Uint8Array(Math.ceil(totalPixels / stride) * 4)
  let si = 0
  let hasTransparent = false
  let k = 0
  for (const f of frames) {
    for (let p = 0; p < f.length; p += 4, k++) {
      if (f[p + 3] === 0) hasTransparent = true
      if (k % stride !== 0) continue
      sample[si++] = f[p]!
      sample[si++] = f[p + 1]!
      sample[si++] = f[p + 2]!
      sample[si++] = f[p + 3]!
    }
  }
  const palette = quantize(sample.subarray(0, si), 256, { format: 'rgba4444', oneBitAlpha: true })
  let transparentIndex = palette.findIndex((c) => (c[3] ?? 255) === 0)
  if (transparentIndex < 0 && hasTransparent) {
    // guarantee a transparent slot: replace the last entry
    if (palette.length >= 256) palette[255] = [0, 0, 0, 0]
    else palette.push([0, 0, 0, 0])
    transparentIndex = palette.length - 1
  }
  return { palette, transparentIndex }
}

export const gifEncoder: EmojiEncoder = {
  format: 'gif',
  supportsAnimation: true,
  async encode(frames: RenderFrame[], opts: EncodeOptions): Promise<EncodedResult> {
    if (frames.length === 0) throw new Error('No frames to encode')

    const { frames: optimized } = optimizeFrames(frames)
    const total = optimized.length
    const work = optimized.map(thresholdAlpha)
    if (opts.shouldCancel?.()) throw new Error('cancelled')
    const { palette, transparentIndex } = globalPalette(work)
    opts.onProgress?.(0.2)

    const gif = GIFEncoder()
    for (let i = 0; i < total; i++) {
      if (opts.shouldCancel?.()) throw new Error('cancelled')
      const f = optimized[i]!
      const index = applyPalette(work[i]!, palette, 'rgba4444')
      gif.writeFrame(index, f.width, f.height, {
        // the palette becomes the GLOBAL colour table on the first frame; passing
        // it again would emit a per-frame local table
        palette: i === 0 ? palette : undefined,
        repeat: i === 0 ? (opts.loop ? 0 : -1) : undefined,
        delay: f.delayMs,
        transparent: transparentIndex >= 0,
        transparentIndex: transparentIndex >= 0 ? transparentIndex : undefined,
        dispose: 2,
      })
      opts.onProgress?.(0.2 + (0.8 * (i + 1)) / total)
    }

    gif.finish()
    const data = gif.bytes()
    return { format: 'gif', data, bytes: data.byteLength, mime: 'image/gif' }
  },
}
