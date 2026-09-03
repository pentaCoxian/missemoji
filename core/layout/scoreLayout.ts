import type { EmojiProject, LayoutMode } from '../project/schema'
import type { LayoutResult } from './types'
import type { LayoutCandidate } from '../text/lineBreakCandidates'
import { readabilityPenaltyForLayout } from '../presets/readability'

/**
 * Score a fitted candidate (spec §7.4). Higher is better. The renderer picks
 * the max-scoring candidate. Layout modes tweak the weights.
 *
 *   score = fontSize*10
 *         - overflowPenalty*1000
 *         - emptySpacePenalty*5
 *         - lineImbalancePenalty*3
 *         - badBreakPenalty*50
 *         - tinyLinePenalty*30
 *         - readabilityPenalty*40
 */
export function scoreCandidate(
  fit: LayoutResult,
  box: { w: number; h: number },
  candidate: LayoutCandidate,
  project: EmojiProject,
): number {
  const w = modeWeights(project.layout.mode)

  // Overflow: how far the measured block exceeds the box (should be ~0 post-fit).
  const overflowW = Math.max(0, fit.blockWidth - box.w)
  const overflowH = Math.max(0, fit.blockHeight - box.h)
  const overflowPenalty = (overflowW + overflowH) / Math.max(1, box.w)

  // Empty space: unused fraction of the box area.
  const usedArea = fit.blockWidth * fit.blockHeight
  const boxArea = box.w * box.h
  const emptySpacePenalty = Math.max(0, 1 - usedArea / Math.max(1, boxArea))

  // Line imbalance: normalized variance of line widths.
  const widths = fit.lines.map((l) => l.width)
  const mean = widths.reduce((a, b) => a + b, 0) / Math.max(1, widths.length)
  const variance =
    widths.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, widths.length)
  const lineImbalancePenalty = Math.sqrt(variance) / Math.max(1, mean)

  const badBreakPenalty = candidate.kinsokuViolations
  const tinyLinePenalty = candidate.orphanLines

  // readabilityPenalty (spec §7.4 / §16): legibility at small sizes, outline
  // thickness, line count. Steers the solver toward readable candidates.
  const readabilityPenalty = readabilityPenaltyForLayout(project, fit)

  return (
    fit.fontSize * 10 * w.fontSize -
    overflowPenalty * 1000 -
    emptySpacePenalty * 5 * w.emptySpace -
    lineImbalancePenalty * 3 * w.imbalance -
    badBreakPenalty * 50 * w.badBreak -
    tinyLinePenalty * 30 -
    readabilityPenalty * 40
  )
}

interface ModeWeights {
  fontSize: number
  emptySpace: number
  imbalance: number
  badBreak: number
}

function modeWeights(mode: LayoutMode): ModeWeights {
  switch (mode) {
    case 'fill':
      // aggressively fill: care less about empty space penalty being avoided,
      // care more about big font size.
      return { fontSize: 1.3, emptySpace: 2, imbalance: 0.7, badBreak: 1 }
    case 'impact':
      return { fontSize: 1.5, emptySpace: 1.5, imbalance: 0.5, badBreak: 0.8 }
    case 'safe':
      return { fontSize: 0.9, emptySpace: 0.7, imbalance: 1, badBreak: 1 }
    case 'compact':
      return { fontSize: 0.8, emptySpace: 0.5, imbalance: 1.2, badBreak: 1 }
    case 'jp-balanced':
      return { fontSize: 1, emptySpace: 1, imbalance: 1.6, badBreak: 1.8 }
    default:
      return { fontSize: 1, emptySpace: 1, imbalance: 1, badBreak: 1 }
  }
}
