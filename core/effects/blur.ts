import {
  createSurface,
  supportsCanvasFilter,
  type AnyCanvas,
  type RenderSurface,
} from '../render/renderContext'
import { boxBlurRGBA } from './boxblur'

/**
 * Return a NEW surface holding a Gaussian-ish blur of `src`. Uses `ctx.filter`
 * when the context supports it, otherwise a premultiplied box blur (worker
 * safe). Premultiplying before the fallback blur avoids dark fringes where
 * fully transparent (0,0,0,0) pixels would otherwise bleed into coloured ones.
 */
export function blurredCopy(src: AnyCanvas, w: number, h: number, radiusPx: number): RenderSurface {
  const out = createSurface(w, h)
  if (radiusPx < 0.5) {
    out.ctx.drawImage(src, 0, 0)
    return out
  }
  if (supportsCanvasFilter(out.ctx)) {
    out.ctx.filter = `blur(${radiusPx}px)`
    out.ctx.drawImage(src, 0, 0)
    out.ctx.filter = 'none'
    return out
  }
  out.ctx.drawImage(src, 0, 0)
  const img = out.ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]! / 255
    d[i] = d[i]! * a
    d[i + 1] = d[i + 1]! * a
    d[i + 2] = d[i + 2]! * a
  }
  boxBlurRGBA(d, w, h, radiusPx)
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]!
    if (a === 0) continue
    const inv = 255 / a
    d[i] = d[i]! * inv
    d[i + 1] = d[i + 1]! * inv
    d[i + 2] = d[i + 2]! * inv
  }
  out.ctx.putImageData(img, 0, 0)
  return out
}
