import type { EmojiProject } from '../project/schema'

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
 * Compute effect margins. `overshootPx` comes from the active animation
 * preset's declared overshoot (0 for static); passed in so this stays pure and
 * does not depend on the preset registry.
 */
export function computeSafeMargins(project: EmojiProject, overshootPx = 0): SafeMargins {
  const padding = project.layout.padding

  const stroke = project.style.strokes.reduce((m, s) => Math.max(m, s.width), 0)

  const shadow = project.style.shadows.reduce(
    (m, s) => Math.max(m, s.blur + Math.max(Math.abs(s.offsetX), Math.abs(s.offsetY))),
    0,
  )

  const glow = project.style.glows.reduce((m, g) => Math.max(m, g.radius), 0)

  // paintStrokes draws lineWidth = 2 × width (half hidden under the fill), so
  // the outline reaches `width` px outside the glyph outline.
  const total = padding + Math.max(stroke, shadow, glow) + overshootPx

  return { padding, stroke, shadow, glow, overshoot: overshootPx, total }
}
