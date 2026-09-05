import type { LayoutResult } from './types'

/**
 * Per-line justification — the "block warp" look from Photoshop/Illustrator,
 * where every line is scaled to the same width so the block reads as a solid
 * rectangle regardless of how many characters each line holds.
 *
 * The uniform fit sizes the text so the WIDEST line fits the box, which leaves
 * shorter lines visibly narrower — with uneven breaks (a 4-character line above
 * a 2-character one) the block looks ragged and wastes space that matters a lot
 * at Misskey's 18-35px reaction sizes. Here each line instead gets its own
 * horizontal scale so it fills the target width.
 *
 * Scale is per line and horizontal only: scaling a line vertically too would
 * change its cap height and break the baseline rhythm, which reads as an
 * accident rather than a design. Photoshop's block warp does the same.
 */

/** Per-line horizontal scale factors, one per line, in layout order. */
export type LineScales = number[]

export interface JustifyLimits {
  /** most a line may be condensed (0.5 = half width) */
  min: number
  /** most a line may be expanded */
  max: number
}

/** Defaults chosen so a lone wide glyph does not blow up into a banner. */
export const DEFAULT_JUSTIFY_LIMITS: JustifyLimits = { min: 0.5, max: 3 }

/**
 * Compute the per-line scale that makes each line fill `targetWidth`.
 *
 * Lines that are empty or have no measurable width keep a scale of 1: there is
 * nothing to stretch, and dividing by zero would poison the layout.
 */
export function computeLineScales(
  lineWidths: readonly number[],
  targetWidth: number,
  limits: JustifyLimits = DEFAULT_JUSTIFY_LIMITS,
): LineScales {
  if (!(targetWidth > 0)) return lineWidths.map(() => 1)
  return lineWidths.map((w) => {
    if (!(w > 0)) return 1
    return clamp(targetWidth / w, limits.min, limits.max)
  })
}

/**
 * The width every line is stretched toward: the widest line, so the block keeps
 * the size the uniform fit already proved fits the box. Using the box width
 * instead would re-introduce the overflow the fit just solved away, because a
 * fit is limited by height as often as by width.
 */
export function justifyTargetWidth(lineWidths: readonly number[]): number {
  let max = 0
  for (const w of lineWidths) if (w > max) max = w
  return max
}

/**
 * Attach per-line scales to a fitted layout. Returns the layout unchanged when
 * justification is off or there is nothing to justify (a single line is already
 * as wide as the widest line, by definition).
 */
export function applyLineJustify(
  fit: LayoutResult,
  enabled: boolean,
  limits: JustifyLimits = DEFAULT_JUSTIFY_LIMITS,
): LayoutResult {
  if (!enabled || fit.lines.length < 2) return fit
  const widths = fit.lines.map((l) => l.width)
  const target = justifyTargetWidth(widths)
  const lineScales = computeLineScales(widths, target, limits)
  // Nothing to do if every line already fills the target.
  if (lineScales.every((s) => s === 1)) return fit
  return { ...fit, lineScales }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
