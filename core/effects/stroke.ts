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
 * outer extent is `width` after the 2× below — matched by computeSafeMargins.
 *
 * `strokes[].width` is in RENDER px here: the caller resolved the stored
 * canvas-size fraction (see core/project/units.ts).
 */
export function paintStrokes(
  ctx: Ctx2D,
  font: FontSpec,
  placement: TextPlacement,
  strokes: StrokeSpec[],
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
    ctx.lineWidth = s.width * 2
    paintPlacedText(ctx, font, placement, 'stroke')
  }
}
