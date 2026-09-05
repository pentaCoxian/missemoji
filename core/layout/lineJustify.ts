import type { LayoutResult } from './types'

/**
 * Per-line size justification — the block look from Photoshop/Illustrator where
 * every line fills the same width, so an uneven set of line breaks still reads
 * as a solid rectangle.
 *
 * The uniform fit sizes the text so the WIDEST line fits the box, which leaves
 * shorter lines visibly narrower. With uneven breaks (a 5-cluster line above a
 * 2-cluster one) the block looks ragged and wastes width that matters a lot at
 * Misskey's 18-35px reaction sizes.
 *
 * Each line gets its own FONT SIZE rather than a horizontal stretch: a line of
 * two wide glyphs should be set larger, not smeared. Stretching distorts letter
 * proportions, which is exactly what the block style is not.
 *
 * Because a bigger font size is also a taller line, the block's height changes,
 * so the whole set is scaled back down until it fits the box again.
 */

export interface JustifyLimits {
  /** smallest per-line size, as a multiple of the uniform fit */
  min: number
  /** largest per-line size, as a multiple of the uniform fit */
  max: number
}

/**
 * How far a line's size may stray from the uniform fit. The spread is what the
 * style is made of — a 2-cluster line grows, a 7-cluster line shrinks — so the
 * range is generous. The ceiling matters beyond taste: leading follows a line's
 * own size, so a line many times larger than its neighbours reserves a gap far
 * taller than its (CJK) ink and leaves a hole under itself. 3.5x keeps a
 * one-glyph line dramatic without opening that hole.
 */
export const DEFAULT_JUSTIFY_LIMITS: JustifyLimits = { min: 0.35, max: 3.5 }

/**
 * Per-line size multipliers that make each line fill `targetWidth`.
 *
 * A line's advance width scales linearly with font size (the same glyphs, same
 * spacing, just a bigger em), so the multiplier is simply the width ratio.
 * Empty or zero-width lines keep 1: there is nothing to fill, and dividing by
 * zero would poison the layout.
 */
export function computeLineSizes(
  lineWidths: readonly number[],
  targetWidth: number,
  limits: JustifyLimits = DEFAULT_JUSTIFY_LIMITS,
): number[] {
  if (!(targetWidth > 0)) return lineWidths.map(() => 1)
  return lineWidths.map((w) => (w > 0 ? clamp(targetWidth / w, limits.min, limits.max) : 1))
}

/**
 * The width every line is sized toward: the full box.
 *
 * Sizing toward the widest line instead would pin the LONGEST line at exactly
 * 1x, so it could only ever grow the others — but the style needs long lines to
 * shrink too (see the two-word line under a long phrase). Targeting the box
 * makes size purely a function of line length, and the block is scaled once at
 * the end to fit the height, so nothing overflows.
 */
export function justifyTargetWidth(_lineWidths: readonly number[], boxWidth: number): number {
  return boxWidth
}

/**
 * Ink height of a block whose lines have individual sizes.
 *
 * This measures the same thing the renderer draws: baselines separated by the
 * leading of the line each gap follows, plus the first line's ascent above the
 * top baseline and the last line's descent below the bottom one. Summing whole
 * line boxes instead would under-report a block whose first line is much bigger
 * than the uniform fit (its ascent exceeds one nominal leading), and the block
 * would overflow the canvas.
 */
export function justifiedBlockHeight(
  lines: readonly { ascent: number; descent: number }[],
  lineSizes: readonly number[],
  fontSize: number,
  lineHeight: number,
): number {
  if (lines.length === 0) return 0
  let span = 0
  for (let i = 1; i < lines.length; i++) {
    span += justifiedLeading(lines, lineSizes, fontSize, lineHeight, i - 1)
  }
  const firstAscent = lines[0]!.ascent * lineSizes[0]!
  const lastDescent = lines[lines.length - 1]!.descent * lineSizes[lines.length - 1]!
  return span + firstAscent + lastDescent
}

/**
 * Leading between baseline i and i+1, in whatever unit the caller works in.
 *
 * Two things have to hold at once, and with per-line sizes they disagree:
 *
 *  - Rhythm: the gap follows the line it comes after, the way a text engine
 *    advances the pen by the leading of the line it just finished. That alone
 *    is what a uniform block needs.
 *  - Clearance: consecutive baselines must be at least far enough apart that
 *    line i's descent and line i+1's ASCENT do not overlap. A small line
 *    followed by a much larger one advances by the small line's leading, and
 *    the big line's tall ascent then reaches back over its predecessor — the
 *    lines literally cross.
 *
 * Taking the larger of the two keeps ordinary blocks on their normal rhythm and
 * only opens the gap where a size jump would otherwise collide.
 */
/**
 * The uniform breathing space between rows, on top of the ink clearance.
 *
 * Tied to the BASE size (not to either line's own size) precisely so it does
 * not vary from gap to gap; `lineHeight` above 1 opens it, below 1 tightens it,
 * which is what the control means for a justified block.
 */
function evenGap(fontSize: number, lineHeight: number): number {
  return fontSize * (lineHeight - 1)
}

export function justifiedLeading(
  lines: readonly { ascent: number; descent: number }[],
  sizes: readonly number[],
  fontSize: number,
  lineHeight: number,
  i: number,
): number {
  const next = lines[i + 1]
  // The last gap has nothing to clear; the block's own descent closes it.
  if (!next) return fontSize * sizes[i]! * lineHeight
  // The baselines must be at least far enough apart that line i's descent and
  // line i+1's ascent do not touch — otherwise a small line followed by a much
  // larger one advances too little and the big line's tall ascent reaches back
  // over its predecessor. `gap` is the EVEN breathing space added on top, so
  // the visual space between rows is the same everywhere in the block; making
  // the whole leading proportional to the line sizes instead would make the
  // gaps lurch with every size jump.
  const clearance = lines[i]!.descent * sizes[i]! + next.ascent * sizes[i + 1]!
  return clearance + evenGap(fontSize, lineHeight)
}

/**
 * Justify a fitted layout: give each line the size that fills the block width,
 * then shrink the whole block uniformly if the taller lines pushed it past the
 * box. Returns the layout untouched when justification is off, when there is
 * only one line (already the widest), or when the lines are already even.
 */
export function applyLineJustify(
  fit: LayoutResult,
  enabled: boolean,
  box: { w: number; h: number },
  lineHeight: number,
  limits: JustifyLimits = DEFAULT_JUSTIFY_LIMITS,
): LayoutResult {
  if (!enabled || fit.lines.length < 2 || fit.fontSize <= 0) return fit

  const widths = fit.lines.map((l) => l.width)
  const target = justifyTargetWidth(widths, box.w)
  const sizes = computeLineSizes(widths, target, limits)
  if (sizes.every((s) => s === 1)) return fit

  // Bigger lines make a taller block, so scale the whole set back until it fits
  // the box on BOTH axes. Height is measured on real ink (see above). Width can
  // also overflow: the widest line keeps size 1, but a line clamped by `max`
  // stays narrower while others reach the target, and the aspect stretch is
  // applied on top — so check it rather than assuming the fit still holds.
  const height = (ss: number[]) => justifiedBlockHeight(fit.lines, ss, fit.fontSize, lineHeight)
  const rawHeight = height(sizes)
  const rawWidth = Math.max(...fit.lines.map((l, i) => l.width * sizes[i]!), 0)
  // Fit BOTH axes. The aspect stretch runs after this and derives its factors
  // from the block extents, so leaving the block exactly box-sized lets the
  // stretch re-expand it past the safe box; a justified block is already
  // filling the width by construction, so hold it a little inside the box and
  // let the stretch take up the rest.
  const HEADROOM = 0.98
  const shrink = Math.min(
    rawHeight > 0 ? Math.min(1, (box.h * HEADROOM) / rawHeight) : 1,
    rawWidth > 0 ? Math.min(1, (box.w * HEADROOM) / rawWidth) : 1,
  )

  const lineSizes = sizes.map((s) => s * shrink)
  // `lines` keeps UNSCALED per-line metrics: the renderer re-measures each line
  // at `fontSize * lineSizes[i]`, so baking the multiplier in here too would
  // apply it twice and the text would run off the canvas. Only the block totals
  // below describe the justified result, because callers (safe box, bounds
  // validation, aspect stretch) need the real drawn extent.
  const scaled = fit.lines.map((l, i) => l.width * lineSizes[i]!)
  return {
    ...fit,
    lineSizes,
    blockWidth: Math.max(...scaled, 0),
    blockHeight: height(lineSizes),
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
