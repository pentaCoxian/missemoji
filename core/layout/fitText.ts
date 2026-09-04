import type { Ctx2D } from '../render/renderContext'
import type { FontSpec } from '../project/schema'
import type { LayoutLine, LayoutResult } from './types'
import { measureRunCached } from './measureText'

/**
 * Binary-search the largest font size at which the given lines fit within
 * `box` (final px). Pure measurement-based fit (spec §7.3 step 2); the caller
 * (solve.ts) adds pixel-bounds validation for the winning candidate.
 *
 * @param lines  candidate lines as grapheme-cluster arrays
 * @param box    available area in FINAL px (already shrunk by safe margins)
 */
export function fitLines(
  ctx: Ctx2D,
  font: FontSpec,
  lines: string[][],
  box: { w: number; h: number },
  minPx = 6,
  maxPx = 400,
): LayoutResult {
  const warnings: string[] = []

  const measureAt = (sizePx: number) => {
    let blockWidth = 0
    let maxAscent = 0
    let maxDescent = 0
    const measured: LayoutLine[] = lines.map((clusters) => {
      const m = measureRunCached(ctx, font, sizePx, clusters)
      if (m.width > blockWidth) blockWidth = m.width
      if (m.ascent > maxAscent) maxAscent = m.ascent
      if (m.descent > maxDescent) maxDescent = m.descent
      return { clusters, width: m.width, ascent: m.ascent, descent: m.descent }
    })
    const lineGap = sizePx * font.lineHeight
    const blockHeight = lines.length * lineGap
    return { measured, blockWidth, blockHeight, maxAscent, maxDescent }
  }

  const fits = (sizePx: number) => {
    const r = measureAt(sizePx)
    return r.blockWidth <= box.w && r.blockHeight <= box.h
  }

  // Binary search the largest fitting size. The termination tolerance is
  // RELATIVE (a fraction of the current size), not an absolute 0.5 px: an
  // absolute epsilon is coarse on a small canvas and fine on a big one, which
  // would make the fitted size drift slightly between export sizes.
  const TOLERANCE = 1e-4
  let lo = minPx
  let hi = maxPx
  if (!fits(lo)) {
    warnings.push('Text does not fit even at minimum size')
    const r = measureAt(lo)
    return {
      fontSize: lo,
      lines: r.measured,
      blockHeight: r.blockHeight,
      blockWidth: r.blockWidth,
      stretchX: 1,
      stretchY: 1,
      pixelBounds: null,
      warnings,
    }
  }
  // Expand hi if it still fits (rare for tiny text in a big box).
  for (let i = 0; i < 60 && hi - lo > lo * TOLERANCE; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) lo = mid
    else hi = mid
  }

  const size = lo
  const r = measureAt(size)
  return {
    fontSize: size,
    lines: r.measured,
    blockHeight: r.blockHeight,
    blockWidth: r.blockWidth,
    stretchX: 1,
    stretchY: 1,
    pixelBounds: null,
    warnings,
  }
}
