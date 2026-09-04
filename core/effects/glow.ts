import { createSurface, type Ctx2D } from '../render/renderContext'
import type { FontSpec, GlowSpec } from '../project/schema'
import type { TextPlacement } from '../render/renderTextLayer'
import { paintPlacedText, withBlockStretch } from '../render/renderTextLayer'
import { blurredCopy } from './blur'

/**
 * Render glow layers under the text. Each glow draws a blurred, tinted copy of
 * the text silhouette and composites it additively for a luminous look
 * (spec §9 step 5).
 *
 * `glows[].radius` is in RENDER px here: the caller resolved the stored
 * canvas-size fraction (see core/project/units.ts).
 */
export function paintGlows(
  destCtx: Ctx2D,
  font: FontSpec,
  placement: TextPlacement,
  glows: GlowSpec[],
) {
  if (glows.length === 0) return

  const w = destCtx.canvas.width
  const h = destCtx.canvas.height

  for (const glow of glows) {
    if (glow.radius <= 0 || glow.intensity <= 0) continue
    const radiusPx = glow.radius

    // Draw the silhouette to a temp surface, then blur it.
    const tmp = createSurface(w, h)
    tmp.ctx.fillStyle = glow.color
    withBlockStretch(tmp.ctx, placement, { x: 0, y: 0, w, h }, () =>
      paintPlacedText(tmp.ctx, font, placement, 'fill'),
    )
    const blurred = blurredCopy(tmp.canvas, w, h, radiusPx)
    compositeGlow(destCtx, blurred.canvas, glow.intensity)
  }
}

/**
 * Additively composite the blurred silhouette. The total "weight" grows
 * continuously with intensity (so animated glow does not step): whole passes at
 * full alpha plus one fractional pass.
 */
function compositeGlow(destCtx: Ctx2D, glowCanvas: CanvasImageSource, intensity: number) {
  const prevAlpha = destCtx.globalAlpha
  const prevOp = destCtx.globalCompositeOperation
  destCtx.globalCompositeOperation = 'lighter'
  const weight = intensity * (1 + 2 * Math.min(intensity, 1))
  const full = Math.floor(weight)
  const frac = weight - full
  destCtx.globalAlpha = 1
  for (let i = 0; i < full; i++) destCtx.drawImage(glowCanvas, 0, 0)
  if (frac > 0.001) {
    destCtx.globalAlpha = frac
    destCtx.drawImage(glowCanvas, 0, 0)
  }
  destCtx.globalAlpha = prevAlpha
  destCtx.globalCompositeOperation = prevOp
}
