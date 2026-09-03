import { createSurface, type AnyCanvas, type RenderSurface } from './renderContext'

/**
 * Downscale a high-res surface to the final size using stepwise halving, which
 * yields much cleaner anti-aliased edges than a single large drawImage when the
 * reduction factor is > 2× (spec §9). Returns a new surface at the target size.
 */
export function downscaleTo(
  src: AnyCanvas,
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
  targetHeight: number,
): RenderSurface {
  let curW = srcWidth
  let curH = srcHeight
  let curCanvas: AnyCanvas = src

  // Halve repeatedly until within 2× of the target.
  while (curW / 2 >= targetWidth && curH / 2 >= targetHeight) {
    const nextW = Math.max(targetWidth, Math.floor(curW / 2))
    const nextH = Math.max(targetHeight, Math.floor(curH / 2))
    const step = createSurface(nextW, nextH)
    step.ctx.imageSmoothingEnabled = true
    step.ctx.imageSmoothingQuality = 'high'
    step.ctx.drawImage(curCanvas, 0, 0, curW, curH, 0, 0, nextW, nextH)
    curCanvas = step.canvas
    curW = nextW
    curH = nextH
  }

  const out = createSurface(targetWidth, targetHeight)
  out.ctx.imageSmoothingEnabled = true
  out.ctx.imageSmoothingQuality = 'high'
  out.ctx.drawImage(curCanvas, 0, 0, curW, curH, 0, 0, targetWidth, targetHeight)
  return out
}
