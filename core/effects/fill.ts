import type { Ctx2D } from '../render/renderContext'
import type { FillSpec, FontSpec } from '../project/schema'
import type { TextPlacement } from '../render/renderTextLayer'
import type { PaintModulators } from '../animation/model'
import { IDENTITY_PAINT } from '../animation/model'
import { paintPlacedText } from '../render/renderTextLayer'
import { buildLinearGradient } from './gradient'
import { shiftHue } from './color'

/**
 * Paint the text fill (solid color or feathered linear gradient).
 *
 * The gradient is computed over the ENTIRE frame (the full canvas box), not the
 * tight content bounds, so the sweep is consistent across layouts and animation
 * frames; buildLinearGradient additionally feathers the stops to smooth the
 * color transition. `paint.gradientOffset` animates the sweep and
 * `paint.hueShift` / `paint.minSaturation` rotate the fill colours (rainbow).
 */
export function paintFill(
  ctx: Ctx2D,
  font: FontSpec,
  placement: TextPlacement,
  fill: FillSpec,
  paint: PaintModulators = IDENTITY_PAINT,
) {
  const tint = (c: string) =>
    paint.hueShift !== 0 || paint.minSaturation > 0
      ? shiftHue(c, paint.hueShift, paint.minSaturation)
      : c

  if (fill.type === 'solid') {
    ctx.fillStyle = tint(fill.color)
  } else {
    const frameBox = { x: 0, y: 0, w: ctx.canvas.width, h: ctx.canvas.height }
    const tinted = { ...fill, stops: fill.stops.map((s) => ({ ...s, color: tint(s.color) })) }
    ctx.fillStyle = buildLinearGradient(ctx, tinted, frameBox, paint.gradientOffset)
  }
  paintPlacedText(ctx, font, placement, 'fill')
}
