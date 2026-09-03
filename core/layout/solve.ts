import type { EmojiProject } from '../project/schema'
import type { Ctx2D } from '../render/renderContext'
import type { LayoutResult } from './types'
import { segmentLines } from '../text/segmentGraphemes'
import { computeSafeMargins } from './safebox'
import { fitLines } from './fitText'
import { generateCandidates } from '../text/lineBreakCandidates'
import { scoreCandidate } from './scoreLayout'
import { validatePixelBounds } from './validateBounds'
import { computeAspectStretch } from './aspectPack'
import { getPreset, type LayoutHints } from '../animation/presets'

/**
 * Resolve a layout for a project (spec §7).
 *
 * M1 path: single naive candidate (split on \n) → binary-search fit.
 * M3 path (active): generate multiple candidates (1/2/3-line, JP kinsoku) →
 *   fit each → score → return the best.
 *
 * The active animation preset may request layout hints (e.g. marquee wants a
 * single line that may overflow horizontally, unstretched).
 *
 * @param ctx          a 2D context for measurement (any scale; measured in final px)
 * @param overshootPx  animation overshoot reserve (0 for static)
 */
export function solveLayout(ctx: Ctx2D, project: EmojiProject, overshootPx = 0): LayoutResult {
  const margins = computeSafeMargins(project, overshootPx)
  const box = {
    w: Math.max(1, project.export.finalWidth - margins.total * 2),
    h: Math.max(1, project.export.finalHeight - margins.total * 2),
  }
  const hints = activeLayoutHints(project)
  const fitBox = hints.allowOverflowX ? { w: Infinity, h: box.h } : box
  const validate = (fit: LayoutResult) =>
    validatePixelBounds(project, fit, margins.total, { ignoreX: hints.allowOverflowX })

  // Single-line presets (marquee): join everything onto one line.
  if (hints.singleLine) {
    const source = segmentLines(project.text)
    const flat = source.flatMap((line, i) => (i > 0 ? [' ', ...line] : line))
    const fit = fitLines(ctx, project.font, [flat], fitBox)
    const warnings = source.length > 1 ? ['Marquee uses a single line'] : []
    const packed = hints.noStretch ? fit : applyStretch(project, fit, box)
    return validate({ ...packed, warnings: [...packed.warnings, ...warnings] })
  }

  // Manual line breaks: honor \n exactly, single candidate.
  if (project.layout.manualLineBreaks) {
    const lines = segmentLines(project.text)
    const fit = fitLines(ctx, project.font, lines, fitBox)
    const packed = hints.noStretch ? fit : applyStretch(project, fit, box)
    return validate(packed)
  }

  // Auto layout: generate candidates and pick the best-scoring fit.
  const candidates = generateCandidates(project)
  if (candidates.length === 0) {
    return fitLines(ctx, project.font, [[]], box)
  }

  let best: LayoutResult | null = null
  let bestScore = -Infinity
  for (const cand of candidates) {
    const fit = fitLines(ctx, project.font, cand.lines, box)
    const warnings = [...fit.warnings, ...cand.warnings]
    const score = scoreCandidate(fit, box, cand, project)
    if (score > bestScore) {
      bestScore = score
      best = { ...fit, warnings }
    }
  }

  // Pack the winner's glyphs to fill the square (aspect stretch), then validate
  // the real visible pixels against the safe box.
  const packed = hints.noStretch ? best! : applyStretch(project, best!, box)
  return validate(packed)
}

/** Layout hints from the active (enabled) animation preset, if any. */
function activeLayoutHints(project: EmojiProject): LayoutHints {
  if (!project.animation.enabled) return {}
  return getPreset(project.animation.preset)?.layoutHints ?? {}
}

/** Apply per-letter aspect packing to a fitted layout. */
function applyStretch(
  project: EmojiProject,
  fit: LayoutResult,
  box: { w: number; h: number },
): LayoutResult {
  const { stretchX, stretchY } = computeAspectStretch(project, fit, box)
  return { ...fit, stretchX, stretchY }
}
