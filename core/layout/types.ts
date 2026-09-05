import type { Bounds } from '../types'

/**
 * The resolved layout produced by the solver (core/layout/solve.ts) and
 * consumed by the renderer. In M1 a trivial single-candidate version is built
 * inline; M3 replaces the producer with the full candidate/score solver while
 * keeping this shape stable.
 */

/** One laid-out line: its grapheme clusters and measured geometry. */
export interface LayoutLine {
  /** grapheme clusters on this line */
  clusters: string[]
  /** advance width of the line in font px (at the resolved font size) */
  width: number
  /** baseline ascent used for vertical placement */
  ascent: number
  descent: number
}

export interface LayoutResult {
  /** the resolved font size in FINAL px (renderer multiplies by renderScale) */
  fontSize: number
  lines: LayoutLine[]
  /** total laid-out block height in font px */
  blockHeight: number
  /** widest line width in font px */
  blockWidth: number
  /**
   * Non-uniform glyph stretch to pack the text into the square for legibility at
   * small Misskey sizes (spec §16 motivation). 1 = no stretch. The renderer
   * scales glyph advances by `stretchX` and line height by `stretchY`.
   */
  stretchX: number
  stretchY: number
  /**
   * Per-line horizontal scale (block-warp justification), one per line, applied
   * around each line's own centre. Absent when justification is off, which is
   * the common case; treat a missing entry as 1.
   */
  lineScales?: number[]
  /** real visible pixel bounds from a probe render, in FINAL px (may be null pre-probe) */
  pixelBounds: Bounds | null
  /** human-readable warnings from the solve (e.g. kinsoku violations) */
  warnings: string[]
}
