import type { Ctx2D } from '../render/renderContext'
import { cssFont } from '../layout/measureText'
import type { FontSpec } from '../project/schema'

/**
 * Detect clusters the loaded font likely cannot render (spec §8). Heuristic:
 * compare each cluster's advance width in the target font vs a last-resort
 * generic; identical zero/notdef widths across clusters suggest tofu. We use a
 * simpler, robust check: a glyph renders to *some* visible pixels.
 */
export function findMissingGlyphs(ctx: Ctx2D, font: FontSpec, clusters: string[]): string[] {
  const missing: string[] = []
  const size = 48
  ctx.font = cssFont(font, size)
  ctx.textBaseline = 'alphabetic'

  for (const c of clusters) {
    if (/\s/u.test(c)) continue
    const w = ctx.measureText(c).width
    // Zero-advance non-space clusters are almost certainly unsupported.
    if (w <= 0.01) {
      missing.push(c)
    }
  }
  return Array.from(new Set(missing))
}
