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
  /** advance width in placement (unstretched render) px */
  advance: number
  /** line ascent / descent in render px, for the glyph's visual centre */
  ascent: number
  descent: number
  /** indices for per-character animation */
  index: number
  line: number
  indexInLine: number
  /**
   * Block-warp justification factor for this cluster's line (1 = none). The
   * pen positions above already account for it; the painter still needs it to
   * stretch the glyph itself by the same amount.
   */
  lineScale: number
  /** this frame's per-character motion, resolved to placement px (optional) */
  transform?: ResolvedCharTransform
}

/** A per-glyph transform applied around the glyph's visual centre. */
export interface ResolvedCharTransform {
  dx: number
  dy: number
  sx: number
  sy: number
  /** radians */
  rot: number
}

export interface TextPlacement {
  clusters: PlacedCluster[]
  fontPx: number
  /** non-uniform glyph stretch (per-letter aspect packing) */
  stretchX: number
  stretchY: number
  /** per-line advance widths in placement px */
  lineWidths: number[]
  lineCount: number
}

/**
 * Scale a measured font metric into render px, falling back only when the
 * metric is genuinely absent. A metric of 0 is a real value (text with no
 * descenders has zero descent) and is kept as-is.
 */
function metricOr(metric: number | undefined, scale: number, fallback: number): number {
  return typeof metric === 'number' && Number.isFinite(metric) ? metric * scale : fallback
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

  // Vertical placement works on the block's REAL ink extent, not on a stack of
  // nominal line boxes. Baselines sit at `top + i*lineGap + ascent`, so the ink
  // runs from the first line's ascent to the last line's descent:
  //
  //   inkHeight = (lineCount - 1) * lineGap + firstAscent + lastDescent
  //
  // Centring on `lineCount * lineGap` instead (the old behaviour) reserved a
  // full line gap under the last baseline while the glyphs only reach their
  // descent, pushing the text upward — visibly so with a tall line height, a
  // single line, or CJK glyphs whose ink is far shorter than the font's
  // nominal descent.
  const firstLine = resolved.lines[0]
  const lastLine = resolved.lines[resolved.lines.length - 1]
  // `?? fallback`, never `|| fallback`: a descent of exactly 0 is legitimate
  // (text with no descenders, e.g. "ABC") and must not be replaced by a
  // fabricated 0.2em, which would push the block upward.
  const firstAscent = metricOr(firstLine?.ascent, scale, fontPx * 0.8)
  const lastDescent = metricOr(lastLine?.descent, scale, fontPx * 0.2)
  const inkHeight = (resolved.lines.length - 1) * lineGap + firstAscent + lastDescent

  // The aspect-packing stretch (withBlockStretch) scales the drawn block about
  // the box centre by `stretchY`, so the ink finally on screen is `inkHeight *
  // stretchY` tall. Alignment has to reason in that final space, then convert
  // back into the unstretched coordinates these placements are expressed in:
  //   drawn_y = cy + (y - cy) * stretchY   =>   y = cy + (drawn_y - cy) / sy
  const cy = box.y + box.h / 2
  const sy = resolved.stretchY || 1
  const drawnInkHeight = inkHeight * sy

  let drawnInkTop: number
  switch (layout.verticalAlign) {
    case 'top':
      drawnInkTop = box.y
      break
    case 'bottom':
      drawnInkTop = box.y + box.h - drawnInkHeight
      break
    default:
      drawnInkTop = cy - drawnInkHeight / 2
  }
  const inkTop = cy + (drawnInkTop - cy) / sy
  // Baselines are computed below as `top + i*lineGap + ascent`, so for the
  // first line to land at `inkTop + firstAscent`, `top` is simply inkTop.
  const top = inkTop

  const placed: PlacedCluster[] = []
  const lineWidths: number[] = []
  let index = 0

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

    // Block-warp justification: widen this line so it fills the block. The
    // advances (and the spacing between them) carry the scale, so the line is
    // laid out at its final width here and each glyph is drawn stretched by
    // the same factor in paintPlacedText. Scaling positions rather than
    // re-fitting keeps every pass — fill, stroke, shadow, glow — in register.
    const lineScale = resolved.lineScales?.[i] ?? 1
    if (lineScale !== 1) {
      for (let w = 0; w < widths.length; w++) widths[w] = widths[w]! * lineScale
      lineWidth *= lineScale
    }
    lineWidths.push(lineWidth)

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

    const ascent = metricOr(line.ascent, scale, fontPx * 0.8)
    const descent = metricOr(line.descent, scale, fontPx * 0.2)
    const baseline = top + i * lineGap + ascent

    let penX = startX
    line.clusters.forEach((c, ci) => {
      placed.push({
        cluster: c,
        x: penX,
        y: baseline,
        advance: widths[ci]!,
        ascent,
        descent,
        index,
        line: i,
        indexInLine: ci,
        lineScale,
      })
      index++
      penX += widths[ci]! + letterSpacing * lineScale
    })
  })

  return {
    clusters: placed,
    fontPx,
    stretchX,
    stretchY,
    lineWidths,
    lineCount: resolved.lines.length,
  }
}

export type TextPass = 'fill' | 'stroke'

/**
 * Draw the placed text using the current ctx paint settings. `pass` selects
 * fillText vs strokeText; the caller sets fillStyle/strokeStyle/lineWidth/etc.
 * The same placement is reused across passes for perfect registration, and a
 * cluster's resolved per-character transform (if any) is applied around its
 * visual centre.
 */
export function paintPlacedText(
  ctx: Ctx2D,
  font: FontSpec,
  placement: TextPlacement,
  pass: TextPass,
) {
  ctx.font = cssFont(font, placement.fontPx)
  ctx.textBaseline = 'alphabetic'
  const draw = (text: string, x: number, y: number) => {
    if (pass === 'fill') ctx.fillText(text, x, y)
    else ctx.strokeText(text, x, y)
  }
  for (const p of placement.clusters) {
    const t = p.transform
    const ls = p.lineScale || 1
    if (ls !== 1) {
      // Justified line: stretch the glyph horizontally about its own pen
      // origin, which is where placeText already put it at the scaled advance.
      const cx = p.x
      const cy = p.y - (p.ascent - p.descent) / 2
      ctx.save()
      ctx.translate(cx + (t?.dx ?? 0), cy + (t?.dy ?? 0))
      if (t?.rot) ctx.rotate(t.rot)
      ctx.scale(ls * (t?.sx ?? 1), t?.sy ?? 1)
      ctx.translate(-cx, -cy)
      draw(p.cluster, p.x, p.y)
      ctx.restore()
    } else if (!t) {
      draw(p.cluster, p.x, p.y)
    } else if (t.sx === 1 && t.sy === 1 && t.rot === 0) {
      // translate-only: no save/restore, gradient space stays canvas-fixed
      draw(p.cluster, p.x + t.dx, p.y + t.dy)
    } else {
      const cx = p.x + p.advance / 2
      const cy = p.y - (p.ascent - p.descent) / 2
      ctx.save()
      ctx.translate(cx + t.dx, cy + t.dy)
      ctx.rotate(t.rot)
      ctx.scale(t.sx, t.sy)
      ctx.translate(-cx, -cy)
      draw(p.cluster, p.x, p.y)
      ctx.restore()
    }
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
