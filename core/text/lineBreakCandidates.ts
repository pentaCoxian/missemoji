import type { EmojiProject, LayoutMode } from '../project/schema'
import { segmentLines } from './segmentGraphemes'
import { hasJapanese, hasSpaces } from './classify'
import { cannotStartLine, cannotEndLine, countKinsokuViolations } from './japaneseRules'

export interface LayoutCandidate {
  /** lines of grapheme clusters */
  lines: string[][]
  warnings: string[]
  /** kinsoku violations that could not be avoided */
  kinsokuViolations: number
  /** count of tiny/orphan trailing lines */
  orphanLines: number
}

/** Line-count range to try, biased by layout mode (spec §7 table). */
function lineCountRange(mode: LayoutMode, clusterCount: number): number[] {
  if (mode === 'impact') return [1, 2]
  if (mode === 'compact') return [2, 3, 4]
  // Heuristic by length for the default modes.
  if (clusterCount <= 4) return [1]
  if (clusterCount <= 10) return [1, 2]
  return [1, 2, 3]
}

/**
 * Split a flat cluster list into roughly even `n` lines using a break-cost
 * scan. For JP (no spaces) every inter-cluster gap is a candidate break,
 * nudged to respect kinsoku. For Latin, prefer spaces.
 */
function splitIntoLines(clusters: string[], n: number): string[][] {
  if (n <= 1) return [clusters]
  const total = clusters.length
  if (total <= n) return clusters.map((c) => [c])

  const useSpaces = hasSpaces(clusters)
  const targets: number[] = []
  for (let i = 1; i < n; i++) targets.push(Math.round((total * i) / n))

  // For each target break index, find the best legal break near it.
  const breakIdx = new Set<number>()
  for (const t of targets) {
    let chosen = t
    if (useSpaces) {
      // search outward for a space to break after
      let found = -1
      for (let d = 0; d < total; d++) {
        for (const cand of [t - d, t + d]) {
          if (cand > 0 && cand < total && /\s/u.test(clusters[cand - 1]!)) {
            found = cand
            break
          }
        }
        if (found >= 0) break
      }
      if (found >= 0) chosen = found
    } else {
      // JP: nudge so we don't strand a NO_LINE_START at the next line's head
      // or a NO_LINE_END at this line's tail.
      for (let d = 0; d < 4; d++) {
        const cand = t + d
        if (
          cand > 0 &&
          cand < total &&
          !cannotStartLine(clusters[cand]!) &&
          !cannotEndLine(clusters[cand - 1]!)
        ) {
          chosen = cand
          break
        }
      }
    }
    breakIdx.add(chosen)
  }

  const sorted = [...breakIdx].sort((a, b) => a - b)
  const lines: string[][] = []
  let start = 0
  for (const b of sorted) {
    if (b > start) {
      lines.push(clusters.slice(start, b))
      start = b
    }
  }
  lines.push(clusters.slice(start))
  // Drop empty lines and trim leading spaces on wrapped lines.
  return lines.map((l, i) => (i > 0 ? trimLeadingSpace(l) : l)).filter((l) => l.length > 0)
}

function trimLeadingSpace(line: string[]): string[] {
  let i = 0
  while (i < line.length && /\s/u.test(line[i]!)) i++
  return line.slice(i)
}

function countOrphans(lines: string[][]): number {
  if (lines.length < 2) return 0
  const max = Math.max(...lines.map((l) => l.length))
  return lines.filter((l) => l.length === 1 && max >= 3).length
}

/**
 * Generate layout candidates for a project (spec §7.2). Always includes the
 * manual/flat split; for multi-cluster text, adds 1/2/3-line balanced splits.
 */
export function generateCandidates(project: EmojiProject): LayoutCandidate[] {
  // Flatten the user's text (respect existing \n as hard breaks first).
  const sourceLines = segmentLines(project.text)
  const flat = sourceLines.flat()
  if (flat.length === 0) {
    return [{ lines: [[]], warnings: [], kinsokuViolations: 0, orphanLines: 0 }]
  }

  const candidates: LayoutCandidate[] = []
  const seen = new Set<string>()

  const push = (lines: string[][]) => {
    const cleaned = lines.filter((l) => l.length > 0)
    if (cleaned.length === 0) return
    const key = cleaned.map((l) => l.join('')).join('\n')
    if (seen.has(key)) return
    seen.add(key)
    candidates.push({
      lines: cleaned,
      warnings: [],
      kinsokuViolations: countKinsokuViolations(cleaned),
      orphanLines: countOrphans(cleaned),
    })
  }

  // Respect user's hard line breaks as one candidate.
  if (sourceLines.length > 1) push(sourceLines)

  const counts = lineCountRange(project.layout.mode, flat.length)
  for (const n of counts) push(splitIntoLines(flat, n))

  // jp-balanced mode: also try one more split level for balance on JP text.
  if (project.layout.mode === 'jp-balanced' && hasJapanese(flat)) {
    push(splitIntoLines(flat, Math.min(4, Math.ceil(flat.length / 3))))
  }

  return candidates
}
