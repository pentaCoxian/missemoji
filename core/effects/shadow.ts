import { createSurface, type Ctx2D } from '../render/renderContext'
import type { FontSpec, ShadowSpec } from '../project/schema'
import type { TextPlacement } from '../render/renderTextLayer'
import { paintPlacedText, withBlockStretch } from '../render/renderTextLayer'
import { blurredCopy } from './blur'

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

    const src = blurPx >= 1 ? blurredCopy(tmp.canvas, w, h, blurPx).canvas : tmp.canvas
    destCtx.drawImage(src, dx, dy)
  }
}
