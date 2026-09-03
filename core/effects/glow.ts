import { createSurface, supportsCanvasFilter, type Ctx2D } from '../render/renderContext'
import type { FontSpec, GlowSpec } from '../project/schema'
import type { TextPlacement } from '../render/renderTextLayer'
import { paintPlacedText, withBlockStretch } from '../render/renderTextLayer'
import { boxBlurRGBA } from './boxblur'

/**
 * Render glow layers under the text. Each glow draws a blurred, tinted copy of
 * the text silhouette and composites it additively for a luminous look
 * (spec §9 step 5). Uses ctx.filter blur when available, else a manual box blur
 * (worker-safe). radius/intensity from the spec; radius scaled to render px.
 */
export function paintGlows(
  destCtx: Ctx2D,
  font: FontSpec,
  placement: TextPlacement,
  glows: GlowSpec[],
  scale: number,
) {
  if (glows.length === 0) return

  const w = destCtx.canvas.width
  const h = destCtx.canvas.height

  for (const glow of glows) {
    if (glow.radius <= 0 || glow.intensity <= 0) continue
    const radiusPx = glow.radius * scale

    // Draw the silhouette to a temp surface.
    const tmp = createSurface(w, h)
    tmp.ctx.fillStyle = glow.color
    withBlockStretch(tmp.ctx, placement, { x: 0, y: 0, w, h }, () =>
      paintPlacedText(tmp.ctx, font, placement, 'fill'),
    )

    if (supportsCanvasFilter(tmp.ctx)) {
      // Re-blur via a second surface using ctx.filter.
      const blurred = createSurface(w, h)
      blurred.ctx.filter = `blur(${radiusPx}px)`
      blurred.ctx.drawImage(tmp.canvas, 0, 0)
      compositeGlow(destCtx, blurred.canvas, glow.intensity)
    } else {
      const img = tmp.ctx.getImageData(0, 0, w, h)
      boxBlurRGBA(img.data, w, h, radiusPx)
      tmp.ctx.putImageData(img, 0, 0)
      compositeGlow(destCtx, tmp.canvas, glow.intensity)
    }
  }
}

function compositeGlow(destCtx: Ctx2D, glowCanvas: CanvasImageSource, intensity: number) {
  const prevAlpha = destCtx.globalAlpha
  const prevOp = destCtx.globalCompositeOperation
  destCtx.globalCompositeOperation = 'lighter'
  // Draw the blurred glow a couple of times scaled by intensity to build it up.
  const passes = Math.max(1, Math.round(1 + intensity * 2))
  destCtx.globalAlpha = Math.min(1, intensity)
  for (let i = 0; i < passes; i++) {
    destCtx.drawImage(glowCanvas, 0, 0)
  }
  destCtx.globalAlpha = prevAlpha
  destCtx.globalCompositeOperation = prevOp
}
