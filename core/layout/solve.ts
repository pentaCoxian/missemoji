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
import { applyLineJustify } from './lineJustify'
import { getPreset, type LayoutHints } from '../animation/presets'
import { fractionToPx, styleBasis, REFERENCE_SIZE } from '../project/units'

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
  const basis = styleBasis(project.export.finalWidth, project.export.finalHeight)

  // Solve at a fixed REFERENCE canvas and scale the answer to the requested
  // size. Style geometry is already resolution-independent (fractions), but
  // font rasterizers quantize glyph advances to whole pixels, so measuring at
  // 128 and at 256 is not perfectly linear — solving twice could pick a
  // slightly different point size or even a different line break. Solving once
  // and scaling guarantees a 256 export is exactly a 2× enlargement of the 128.
  if (basis !== REFERENCE_SIZE && basis > 0) {
    const k = basis / REFERENCE_SIZE
    const ref: EmojiProject = {
      ...project,
      size: { width: REFERENCE_SIZE, height: REFERENCE_SIZE },
      export: {
        ...project.export,
        finalWidth: (project.export.finalWidth / basis) * REFERENCE_SIZE,
        finalHeight: (project.export.finalHeight / basis) * REFERENCE_SIZE,
      },
    }
    return scaleLayout(solveLayout(ctx, ref, overshootPx / k), k)
  }

  const margins = computeSafeMargins(project, overshootPx)
  const box = {
    w: Math.max(1, project.export.finalWidth - margins.total * 2),
    h: Math.max(1, project.export.finalHeight - margins.total * 2),
  }
  // letter spacing is stored as a fraction of canvas size; the solver measures
  // in FINAL px, so resolve it once here
  const letterSpacingPx = fractionToPx(project.font.letterSpacing, basis)
  const hints = activeLayoutHints(project)
  const fitBox = hints.allowOverflowX ? { w: Infinity, h: box.h } : box
  const validate = (fit: LayoutResult) =>
    validatePixelBounds(project, fit, margins.total, { ignoreX: hints.allowOverflowX })

  // Single-line presets (marquee): join everything onto one line.
  if (hints.singleLine) {
    const source = segmentLines(project.text)
    const flat = source.flatMap((line, i) => (i > 0 ? [' ', ...line] : line))
    const fit = fitLines(ctx, project.font, [flat], fitBox, letterSpacingPx)
    const warnings = source.length > 1 ? ['Marquee uses a single line'] : []
    const packed = hints.noStretch ? fit : applyStretch(project, fit, box)
    return validate({ ...packed, warnings: [...packed.warnings, ...warnings] })
  }

  // Manual line breaks: honor \n exactly, single candidate.
  if (project.layout.manualLineBreaks) {
    const lines = segmentLines(project.text)
    const fit = fitLines(ctx, project.font, lines, fitBox, letterSpacingPx)
    const packed = justify(project, hints.noStretch ? fit : applyStretch(project, fit, box))
    return validate(packed)
  }

  // Auto layout: generate candidates and pick the best-scoring fit.
  const candidates = generateCandidates(project)
  if (candidates.length === 0) {
    return fitLines(ctx, project.font, [[]], box, letterSpacingPx)
  }

  let best: LayoutResult | null = null
  let bestScore = -Infinity
  for (const cand of candidates) {
    const fit = fitLines(ctx, project.font, cand.lines, box, letterSpacingPx)
    const warnings = [...fit.warnings, ...cand.warnings]
    const score = scoreCandidate(fit, box, cand, project)
    if (score > bestScore) {
      bestScore = score
      best = { ...fit, warnings }
    }
  }

  // Pack the winner's glyphs to fill the square (aspect stretch), then validate
  // the real visible pixels against the safe box.
  const packed = justify(project, hints.noStretch ? best! : applyStretch(project, best!, box))
  return validate(packed)
}

/** Scale a solved layout (fitted at the reference size) to the real canvas. */
function scaleLayout(layout: LayoutResult, k: number): LayoutResult {
  return {
    // lineScales are ratios, not lengths: they survive the resize unchanged.
    ...layout,
    fontSize: layout.fontSize * k,
    blockWidth: layout.blockWidth * k,
    blockHeight: layout.blockHeight * k,
    lines: layout.lines.map((l) => ({
      ...l,
      width: l.width * k,
      ascent: l.ascent * k,
      descent: l.descent * k,
    })),
    pixelBounds: layout.pixelBounds
      ? {
          minX: layout.pixelBounds.minX * k,
          minY: layout.pixelBounds.minY * k,
          maxX: layout.pixelBounds.maxX * k,
          maxY: layout.pixelBounds.maxY * k,
        }
      : null,
  }
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

/**
 * Per-line block-warp justification, applied after the uniform fit so it
 * stretches lines toward a width already known to fit. Single-line presets
 * (marquee) skip it: there is no ragged edge to even out.
 */
function justify(project: EmojiProject, fit: LayoutResult): LayoutResult {
  return applyLineJustify(fit, project.layout.justifyLines)
}
