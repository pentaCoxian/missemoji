import { createSurface, type Ctx2D } from '../render/renderContext'
import type { FontSpec, ShadowSpec } from '../project/schema'
import type { TextPlacement } from '../render/renderTextLayer'
import { paintPlacedText, withBlockStretch } from '../render/renderTextLayer'
import { blurredCopy } from './blur'

/**
 * Render drop shadows under the text (spec §9 step 4). Each shadow draws a
 * blurred, offset silhouette. Drawn before glow/stroke/fill so it sits behind
 * everything.
 *
 * Blur and offsets are in RENDER px here: the caller resolved the stored
 * canvas-size fractions (see core/project/units.ts).
 */
export function paintShadows(
  destCtx: Ctx2D,
  font: FontSpec,
  placement: TextPlacement,
  shadows: ShadowSpec[],
) {
  if (shadows.length === 0) return

  const w = destCtx.canvas.width
  const h = destCtx.canvas.height

  for (const shadow of shadows) {
    const blurPx = shadow.blur
    const dx = shadow.offsetX
    const dy = shadow.offsetY

    const tmp = createSurface(w, h)
    tmp.ctx.fillStyle = shadow.color
    withBlockStretch(tmp.ctx, placement, { x: 0, y: 0, w, h }, () =>
      paintPlacedText(tmp.ctx, font, placement, 'fill'),
    )

    const src = blurPx >= 1 ? blurredCopy(tmp.canvas, w, h, blurPx).canvas : tmp.canvas
    destCtx.drawImage(src, dx, dy)
  }
}
