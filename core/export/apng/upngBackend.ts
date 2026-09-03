import UPNG from 'upng-js'
import type { ApngBackend } from '../types'
import type { RenderFrame } from '../../types'

/**
 * Day-1 APNG backend using upng-js (MIT, powers Photopea). upng-js encodes
 * full-canvas frames only — our changed-region delta optimization lives in
 * optimizeFrames + (eventually) the WASM backend. `quantizeColors` maps to
 * UPNG's cnum (0 = lossless 32-bit RGBA).
 */
export const upngBackend: ApngBackend = {
  id: 'upng-js',
  async encode(frames: RenderFrame[], opts): Promise<Uint8Array> {
    if (frames.length === 0) throw new Error('No frames to encode')

    const buffers: ArrayBuffer[] = frames.map(
      (f) =>
        f.rgba.buffer.slice(
          f.rgba.byteOffset,
          f.rgba.byteOffset + f.rgba.byteLength,
        ) as ArrayBuffer,
    )
    const delays = frames.map((f) => f.delayMs)
    const cnum = opts.quantizeColors ?? 0

    const out = UPNG.encode(buffers, opts.width, opts.height, cnum, delays)
    return new Uint8Array(out)
  },
}
