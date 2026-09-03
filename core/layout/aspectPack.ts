import type { EmojiProject } from '../project/schema'
import type { LayoutResult } from './types'

/**
 * Per-letter aspect-ratio packing (user request; spec §16 motivation).
 *
 * Misskey emojis render tiny (24-48px in reactions/timeline), so legibility
 * improves a lot when the glyphs FILL the square rather than leaving margins.
 * After the uniform fit picks the largest size that fits, we stretch glyph
 * advances (X) and line height (Y) independently to consume the leftover space,
 * effectively condensing/expanding each letter's aspect ratio to pack the box.
 *
 * The stretch is capped so text stays readable (no grotesque distortion), and
 * scaled by how aggressive the layout mode is:
 *   - fill / impact: pack hard (up to ~1.6x / down to ~0.7x)
 *   - fit (default): moderate packing
 *   - safe / compact: gentle or none
 */
export function computeAspectStretch(
  project: EmojiProject,
  fit: LayoutResult,
  box: { w: number; h: number },
): { stretchX: number; stretchY: number } {
  if (fit.blockWidth <= 0 || fit.blockHeight <= 0) {
    return { stretchX: 1, stretchY: 1 }
  }

  const { maxX, minX, maxY, minY } = limitsFor(project.layout.mode)

  // How much room is left after the uniform fit, per axis.
  const rawX = box.w / fit.blockWidth
  const rawY = box.h / fit.blockHeight

  const stretchX = clamp(rawX, minX, maxX)
  const stretchY = clamp(rawY, minY, maxY)

  return { stretchX, stretchY }
}

interface Limits {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

function limitsFor(mode: EmojiProject['layout']['mode']): Limits {
  switch (mode) {
    case 'fill':
    case 'impact':
      // Pack aggressively for short punchy text.
      return { minX: 0.7, maxX: 1.7, minY: 0.85, maxY: 1.7 }
    case 'compact':
      // Longer text — allow condensing more than expanding.
      return { minX: 0.7, maxX: 1.25, minY: 0.9, maxY: 1.2 }
    case 'safe':
      // Leave effects room; only gentle packing.
      return { minX: 0.9, maxX: 1.2, minY: 0.95, maxY: 1.2 }
    case 'jp-balanced':
      return { minX: 0.85, maxX: 1.35, minY: 0.9, maxY: 1.4 }
    default: // 'fit'
      return { minX: 0.85, maxX: 1.4, minY: 0.9, maxY: 1.4 }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
