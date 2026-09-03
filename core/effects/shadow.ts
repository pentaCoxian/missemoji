import { createSurface, supportsCanvasFilter, type Ctx2D } from '../render/renderContext'
import type { FontSpec, ShadowSpec } from '../project/schema'
import type { TextPlacement } from '../render/renderTextLayer'
import { paintPlacedText, withBlockStretch } from '../render/renderTextLayer'
import { boxBlurRGBA } from './boxblur'

/**
 * Render drop shadows under the text (spec §9 step 4). Each shadow draws a
 * blurred, offset silhouette. Blur/offset are scaled to render px. Drawn before
 * glow/stroke/fill so it sits behind everything.
 */
export function paintShadows(
  destCtx: Ctx2D,
  font: FontSpec,
  placement: TextPlacement,
  shadows: ShadowSpec[],
  scale: number,
) {
  if (shadows.length === 0) return

  const w = destCtx.canvas.width
  const h = destCtx.canvas.height

  for (const shadow of shadows) {
    const blurPx = shadow.blur * scale
    const dx = shadow.offsetX * scale
    const dy = shadow.offsetY * scale

    const tmp = createSurface(w, h)
    tmp.ctx.fillStyle = shadow.color
    withBlockStretch(tmp.ctx, placement, { x: 0, y: 0, w, h }, () =>
      paintPlacedText(tmp.ctx, font, placement, 'fill'),
    )

    if (blurPx >= 1) {
      if (supportsCanvasFilter(tmp.ctx)) {
        const blurred = createSurface(w, h)
        blurred.ctx.filter = `blur(${blurPx}px)`
        blurred.ctx.drawImage(tmp.canvas, 0, 0)
        destCtx.drawImage(blurred.canvas, dx, dy)
        continue
      }
      const img = tmp.ctx.getImageData(0, 0, w, h)
      boxBlurRGBA(img.data, w, h, blurPx)
      tmp.ctx.putImageData(img, 0, 0)
    }
    destCtx.drawImage(tmp.canvas, dx, dy)
  }
}
