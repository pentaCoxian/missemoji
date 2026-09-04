import type { EmojiProject } from '../project/schema'
import { fractionToPx, styleBasis } from '../project/units'

/**
 * The safe box is the inner area that text must visually fit within, after
 * reserving room for effect bleed and animation overshoot (spec §7.3).
 * Returned in FINAL pixels (caller multiplies by renderScale as needed).
 */
export interface SafeMargins {
  /** padding from layout */
  padding: number
  /** widest stroke: the visible outline extends a full `width` past the glyph path */
  stroke: number
  /** shadow reach = max(blur + |offset|) */
  shadow: number
  /** glow reach = max(radius) */
  glow: number
  /** extra room for animation motion beyond the base box, in px */
  overshoot: number
  /** total single-side margin = padding + max(stroke, shadow, glow) + overshoot */
  total: number
}

/**
 * Compute effect margins. Style geometry is stored as a fraction of canvas size
 * (core/project/units.ts), so it is resolved to FINAL px here — which is what
 * keeps the fitted point size proportional at every export size.
 *
 * `overshootPx` comes from the active animation preset's measured reach (0 for
 * static); passed in so this stays pure and does not depend on the registry.
 */
export function computeSafeMargins(project: EmojiProject, overshootPx = 0): SafeMargins {
  const basis = styleBasis(project.export.finalWidth, project.export.finalHeight)
  const px = (fraction: number) => fractionToPx(fraction, basis)

  const padding = px(project.layout.padding)

  const stroke = project.style.strokes.reduce((m, s) => Math.max(m, px(s.width)), 0)

  const shadow = project.style.shadows.reduce(
    (m, s) => Math.max(m, px(s.blur) + Math.max(Math.abs(px(s.offsetX)), Math.abs(px(s.offsetY)))),
    0,
  )

  const glow = project.style.glows.reduce((m, g) => Math.max(m, px(g.radius)), 0)

  // paintStrokes draws lineWidth = 2 × width (half hidden under the fill), so
  // the outline reaches `width` px outside the glyph outline.
  const total = padding + Math.max(stroke, shadow, glow) + overshootPx

  return { padding, stroke, shadow, glow, overshoot: overshootPx, total }
}
