import type { EmojiProject } from '../project/schema'
import type { LayoutResult } from '../layout/types'
import { fractionToPx, styleBasis } from '../project/units'

/**
 * Readability scoring (spec §16). Produces a 0..1 penalty (higher = worse) used
 * both as the `readabilityPenalty` term in the layout score (so the solver
 * prefers legible candidates) and to drive user warnings.
 *
 * Pure: depends only on the project + fitted layout.
 */
export function readabilityPenalty(
  project: EmojiProject,
  fit: { fontSize: number; lineCount: number },
): number {
  let penalty = 0

  // Effective on-screen size at the smallest common preview (24px).
  const ratio = 24 / project.export.finalWidth
  const effectivePx = fit.fontSize * ratio
  if (effectivePx < 6) penalty += (6 - effectivePx) / 6 // up to ~1

  // Thick outline relative to glyph size closes counters.
  // stroke width is a fraction of canvas size; the fitted size is in final px
  const basis = styleBasis(project.export.finalWidth, project.export.finalHeight)
  const maxStroke = project.style.strokes.reduce(
    (m, s) => Math.max(m, fractionToPx(s.width, basis)),
    0,
  )
  if (fit.fontSize > 0) {
    const strokeRatio = maxStroke / fit.fontSize
    if (strokeRatio > 0.2) penalty += Math.min(0.5, (strokeRatio - 0.2) * 2)
  }

  // Lots of tiny lines hurt legibility.
  if (fit.lineCount > 3) penalty += (fit.lineCount - 3) * 0.1

  return Math.min(1, penalty)
}

/**
 * Wrapper used by scoreLayout: takes a LayoutResult and returns the penalty.
 */
export function readabilityPenaltyForLayout(project: EmojiProject, layout: LayoutResult): number {
  return readabilityPenalty(project, {
    fontSize: layout.fontSize,
    lineCount: layout.lines.length,
  })
}
