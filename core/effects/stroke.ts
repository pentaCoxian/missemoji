import type { Ctx2D } from '../render/renderContext'
import type { FontSpec, StrokeSpec } from '../project/schema'
import type { TextPlacement } from '../render/renderTextLayer'
import { paintPlacedText } from '../render/renderTextLayer'

/**
 * Paint outline strokes. Multiple strokes form a "double outline": they are
 * drawn outermost-first (widest first) so inner strokes layer on top, with
 * round joins to avoid spikes (spec §15). Stroke widths are in render px.
 *
 * Note canvas strokeText centers the stroke on the glyph path, so the visible
 * outer extent is width/2 — matched by computeSafeMargins (stroke/2).
 */
export function paintStrokes(
  ctx: Ctx2D,
  font: FontSpec,
  placement: TextPlacement,
  strokes: StrokeSpec[],
  scale: number,
) {
  if (strokes.length === 0) return

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.miterLimit = 2

  // Sort widest-first; a stroke is drawn at 2× its nominal width because half
  // is hidden under the fill, giving the intended visible outline thickness.
  const ordered = [...strokes].sort((a, b) => b.width - a.width)
  for (const s of ordered) {
    ctx.strokeStyle = s.color
    ctx.lineWidth = s.width * 2 * scale
    paintPlacedText(ctx, font, placement, 'stroke')
  }
}
