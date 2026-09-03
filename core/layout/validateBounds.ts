import type { EmojiProject } from '../project/schema'
import type { LayoutResult } from './types'
import type { Bounds } from '../types'
import { createSurface } from '../render/renderContext'
import { placeText, paintPlacedText, withBlockStretch } from '../render/renderTextLayer'
import { getAlphaBounds } from './pixelBounds'

/**
 * Validate that a fitted layout's REAL visible pixels fit the safe box, not just
 * its metric box (spec §7.3 steps 4-6). Decorative/handwritten fonts overflow
 * their metrics; this probe-renders the fill silhouette at a small scale and
 * measures actual alpha bounds. If the content overflows, we shrink fontSize by
 * the overflow ratio and return the corrected layout.
 *
 * Kept cheap: rendered at probe scale (final px, scale 1), fill-only.
 */
export function validatePixelBounds(
  project: EmojiProject,
  layout: LayoutResult,
  safeMarginPx: number,
): LayoutResult {
  if (layout.lines.length === 0) return layout

  const finalW = project.export.finalWidth
  const finalH = project.export.finalHeight
  const surface = createSurface(finalW, finalH)
  const ctx = surface.ctx
  ctx.clearRect(0, 0, finalW, finalH)

  const placement = placeText(ctx, project.font, project.layout, layout, 1, {
    x: 0,
    y: 0,
    w: finalW,
    h: finalH,
  })
  ctx.fillStyle = '#ffffff'
  withBlockStretch(ctx, placement, { x: 0, y: 0, w: finalW, h: finalH }, () =>
    paintPlacedText(ctx, project.font, placement, 'fill'),
  )

  const img = ctx.getImageData(0, 0, finalW, finalH)
  const bounds: Bounds = getAlphaBounds(img.data, finalW, finalH, 1)

  // Safe box in final px.
  const safe = {
    minX: safeMarginPx,
    minY: safeMarginPx,
    maxX: finalW - safeMarginPx,
    maxY: finalH - safeMarginPx,
  }

  // Compute overflow ratio if content escapes the safe box.
  const overL = Math.max(0, safe.minX - bounds.minX)
  const overR = Math.max(0, bounds.maxX - safe.maxX)
  const overT = Math.max(0, safe.minY - bounds.minY)
  const overB = Math.max(0, bounds.maxY - safe.maxY)

  const contentW = bounds.maxX - bounds.minX
  const contentH = bounds.maxY - bounds.minY
  const safeW = safe.maxX - safe.minX
  const safeH = safe.maxY - safe.minY

  let shrink = 1
  if ((overL > 0 || overR > 0) && contentW > 0) {
    shrink = Math.min(shrink, safeW / contentW)
  }
  if ((overT > 0 || overB > 0) && contentH > 0) {
    shrink = Math.min(shrink, safeH / contentH)
  }

  if (shrink < 0.999) {
    const newSize = Math.max(6, layout.fontSize * shrink)
    return {
      ...layout,
      fontSize: newSize,
      pixelBounds: bounds,
      warnings: [...layout.warnings, 'Visible pixels exceeded safe box; shrunk to fit'],
    }
  }

  return { ...layout, pixelBounds: bounds }
}
