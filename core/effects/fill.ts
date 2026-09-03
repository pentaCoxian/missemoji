import type { Ctx2D } from '../render/renderContext'
import type { FillSpec } from '../project/schema'
import type { TextPlacement } from '../render/renderTextLayer'
import type { FontSpec } from '../project/schema'
import { paintPlacedText } from '../render/renderTextLayer'
import { buildLinearGradient } from './gradient'

/**
 * Paint the text fill (solid color or feathered linear gradient).
 *
 * The gradient is computed over the ENTIRE frame (the full canvas box), not the
 * tight content bounds, so the sweep is consistent across layouts and animation
 * frames; buildLinearGradient additionally feathers the stops to smooth the
 * color transition. `gradientOffset` animates the sweep.
 */
export function paintFill(
  ctx: Ctx2D,
  font: FontSpec,
  placement: TextPlacement,
  fill: FillSpec,
  gradientOffset = 0,
) {
  if (fill.type === 'solid') {
    ctx.fillStyle = fill.color
  } else {
    const frameBox = {
      x: 0,
      y: 0,
      w: ctx.canvas.width,
      h: ctx.canvas.height,
    }
    ctx.fillStyle = buildLinearGradient(ctx, fill, frameBox, gradientOffset)
  }
  paintPlacedText(ctx, font, placement, 'fill')
}
