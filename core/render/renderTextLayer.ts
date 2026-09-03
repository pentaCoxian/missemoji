import type { Ctx2D } from './renderContext'
import type { FontSpec, LayoutSpec } from '../project/schema'
import type { LayoutResult } from '../layout/types'
import { cssFont } from '../layout/measureText'

/**
 * Per-cluster placement: where each grapheme's pen position sits, in the render
 * surface's pixel space. Computed once from the LayoutResult so every text
 * pass (fill / stroke / glow / shadow) shares identical geometry — guaranteeing
 * pixel-perfect alignment between layers (spec §9).
 */
export interface PlacedCluster {
  cluster: string
  x: number
  /** alphabetic baseline y */
  y: number
}

export interface TextPlacement {
  clusters: PlacedCluster[]
  fontPx: number
  /** non-uniform glyph stretch (per-letter aspect packing) */
  stretchX: number
  stretchY: number
}

/**
 * Compute glyph placements for a resolved layout, scaled to the render surface.
 *
 * @param scale  renderScale (final px -> render px)
 * @param box    the target box in render px (usually the whole surface)
 */
export function placeText(
  ctx: Ctx2D,
  font: FontSpec,
  layout: LayoutSpec,
  resolved: LayoutResult,
  scale: number,
  box: { x: number; y: number; w: number; h: number },
): TextPlacement {
  const fontPx = resolved.fontSize * scale
  ctx.font = cssFont(font, fontPx)
  ctx.textBaseline = 'alphabetic'

  // Per-letter aspect packing is applied as a single block-level transform in
  // the render pipeline (around the block centre) so glyph shapes AND the fill
  // gradient stretch coherently. Placement here is in UNSTRETCHED coordinates;
  // we just report the stretch factors for the caller to apply.
  const stretchX = resolved.stretchX || 1
  const stretchY = resolved.stretchY || 1

  const lineGap = fontPx * font.lineHeight
  const letterSpacing = font.letterSpacing * scale

  // Total block height for vertical alignment.
  const blockHeight = resolved.lines.length * lineGap
  let top: number
  switch (layout.verticalAlign) {
    case 'top':
      top = box.y
      break
    case 'bottom':
      top = box.y + box.h - blockHeight
      break
    default:
      top = box.y + (box.h - blockHeight) / 2
  }

  const placed: PlacedCluster[] = []

  resolved.lines.forEach((line, i) => {
    // Unstretched glyph advances (block-level transform applies the stretch).
    let lineWidth = 0
    const widths: number[] = []
    for (const c of line.clusters) {
      const w = ctx.measureText(c).width
      widths.push(w)
      lineWidth += w + letterSpacing
    }
    if (line.clusters.length > 0) lineWidth -= letterSpacing

    let startX: number
    switch (layout.align) {
      case 'left':
        startX = box.x
        break
      case 'right':
        startX = box.x + box.w - lineWidth
        break
      default:
        startX = box.x + (box.w - lineWidth) / 2
    }

    const ascent = line.ascent * scale || fontPx * 0.8
    const baseline = top + i * lineGap + ascent

    let penX = startX
    line.clusters.forEach((c, ci) => {
      placed.push({ cluster: c, x: penX, y: baseline })
      penX += widths[ci]! + letterSpacing
    })
  })

  return { clusters: placed, fontPx, stretchX, stretchY }
}

export type TextPass = 'fill' | 'stroke'

/**
 * Draw the placed text using the current ctx paint settings. `pass` selects
 * fillText vs strokeText; the caller sets fillStyle/strokeStyle/lineWidth/etc.
 * The same placement is reused across passes for perfect registration.
 */
export function paintPlacedText(
  ctx: Ctx2D,
  font: FontSpec,
  placement: TextPlacement,
  pass: TextPass,
) {
  ctx.font = cssFont(font, placement.fontPx)
  ctx.textBaseline = 'alphabetic'
  for (const p of placement.clusters) {
    if (pass === 'fill') ctx.fillText(p.cluster, p.x, p.y)
    else ctx.strokeText(p.cluster, p.x, p.y)
  }
}

/**
 * Apply the placement's aspect-packing stretch as a single block-level
 * transform around the block centre, then run `draw`. Because the whole block
 * (glyphs + fill gradient) is scaled together, the gradient stays coherent —
 * unlike per-glyph scaling, which distorts gradient space per letter.
 */
export function withBlockStretch(
  ctx: Ctx2D,
  placement: TextPlacement,
  box: { x: number; y: number; w: number; h: number },
  draw: () => void,
) {
  const sx = placement.stretchX || 1
  const sy = placement.stretchY || 1
  if (sx === 1 && sy === 1) {
    draw()
    return
  }
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(sx, sy)
  ctx.translate(-cx, -cy)
  draw()
  ctx.restore()
}
