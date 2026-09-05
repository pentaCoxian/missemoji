import type { Ctx2D } from './renderContext'
import type { FontSpec, LayoutSpec } from '../project/schema'
import type { LayoutResult } from '../layout/types'
import { cssFont } from '../layout/measureText'
import { justifiedLeading } from '../layout/lineJustify'

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
   * Font size this cluster is set at, in render px. Equals the placement's
   * `fontPx` unless block justification gave the line its own size, so the
   * painter must set ctx.font per cluster rather than once per pass.
   */
  fontPx: number
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

  const letterSpacing = font.letterSpacing * scale

  // Vertical placement works on the block's REAL ink extent, not on a stack of
  // nominal line boxes. Baselines sit an ascent below each line's top, so the ink
  // runs from the first line's ascent to the last line's descent:
  //
  //   inkHeight = (sum of the leadings between baselines) + firstAscent + lastDescent
  //
  // Centring on a full line box per line instead (the old behaviour) reserved a
  // full line gap under the last baseline while the glyphs only reach their
  // descent, pushing the text upward — visibly so with a tall line height, a
  // single line, or CJK glyphs whose ink is far shorter than the font's
  // nominal descent.
  const firstLine = resolved.lines[0]
  const lastLine = resolved.lines[resolved.lines.length - 1]
  // `?? fallback`, never `|| fallback`: a descent of exactly 0 is legitimate
  // (text with no descenders, e.g. "ABC") and must not be replaced by a
  // fabricated 0.2em, which would push the block upward.
  const firstSizeK = resolved.lineSizes?.[0] ?? 1
  const lastSizeK = resolved.lineSizes?.[resolved.lines.length - 1] ?? 1
  const firstAscent = metricOr(firstLine?.ascent, scale * firstSizeK, fontPx * firstSizeK * 0.8)
  const lastDescent = metricOr(lastLine?.descent, scale * lastSizeK, fontPx * lastSizeK * 0.2)
  // With block justification each line has its own size, so leading varies per
  // line: the gap from baseline i-1 to baseline i is set by the line the gap
  // follows, the way a text engine advances the pen by the leading of the line
  // it just finished. It comes from the shared helper so the layout's reported
  // block height and what is placed here cannot drift apart — a mismatch makes
  // the aspect stretch size the block wrongly and the text land off-centre. The
  // helper works in whatever unit it is given, so feed it RENDER px throughout.
  const sizes = resolved.lines.map((_, i) => resolved.lineSizes?.[i] ?? 1)
  const scaledLines = resolved.lines.map((l) => ({
    ascent: metricOr(l.ascent, scale, fontPx * 0.8),
    descent: metricOr(l.descent, scale, fontPx * 0.2),
  }))
  const leadingAfter = (i: number) =>
    justifiedLeading(scaledLines, sizes, fontPx, font.lineHeight, i)
  let baselineSpan = 0
  for (let i = 1; i < resolved.lines.length; i++) baselineSpan += leadingAfter(i - 1)
  const inkHeight = baselineSpan + firstAscent + lastDescent

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
  // Baselines are accumulated below starting from `top`, so for the first line
  // to land at `inkTop + firstAscent`, `top` is simply inkTop.
  const top = inkTop

  const placed: PlacedCluster[] = []
  const lineWidths: number[] = []
  let index = 0

  let baselineY = top
  resolved.lines.forEach((line, i) => {
    // Block justification sets each line at its own size so the glyphs keep
    // their proportions (a stretch would smear them). Measure this line at
    // that size; letter spacing scales with it so tracking stays proportional.
    const lineFontPx = fontPx * (resolved.lineSizes?.[i] ?? 1)
    // Set the font for EVERY line, not just the ones that differ from the base:
    // a previous line may have left its own (larger) size on the context, and a
    // line at size 1 would then be measured with it.
    ctx.font = cssFont(font, lineFontPx)
    const lineSpacing = letterSpacing * (lineFontPx / fontPx)

    let lineWidth = 0
    const widths: number[] = []
    for (const c of line.clusters) {
      const w = ctx.measureText(c).width
      widths.push(w)
      lineWidth += w + lineSpacing
    }
    if (line.clusters.length > 0) lineWidth -= lineSpacing
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

    // Stored metrics describe the line at the BASE size, so scale them by the
    // line's own multiplier — the glyphs really are that much taller.
    const sizeK = lineFontPx / fontPx
    const ascent = metricOr(line.ascent, scale * sizeK, lineFontPx * 0.8)
    const descent = metricOr(line.descent, scale * sizeK, lineFontPx * 0.2)
    // Advance the running baseline: the first sits an ascent below the block
    // top, each later one exactly one leading below its predecessor. Keeping
    // the ACCUMULATOR on the baseline (rather than adding the ascent to a
    // top-relative running total) is what makes the gap between consecutive
    // baselines equal the leading — otherwise it also picks up the difference
    // between the two lines' ascents, which with per-line sizes is large.
    baselineY = i === 0 ? top + ascent : baselineY + leadingAfter(i - 1)
    const baseline = baselineY

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
        fontPx: lineFontPx,
      })
      index++
      penX += widths[ci]! + lineSpacing
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
  ctx.textBaseline = 'alphabetic'
  // Block justification gives lines their own size, so track the size actually
  // set on the context and only re-assign ctx.font when it changes (setting it
  // per glyph would re-parse the font shorthand thousands of times a frame).
  let currentFontPx = NaN
  const useFont = (px: number) => {
    if (px === currentFontPx) return
    ctx.font = cssFont(font, px)
    currentFontPx = px
  }
  const draw = (text: string, x: number, y: number) => {
    if (pass === 'fill') ctx.fillText(text, x, y)
    else ctx.strokeText(text, x, y)
  }
  for (const p of placement.clusters) {
    const t = p.transform
    useFont(p.fontPx)
    if (!t) {
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
