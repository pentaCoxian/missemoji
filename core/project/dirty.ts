import type { EmojiProject } from './schema'
import { computeSafeMargins } from '../layout/safebox'
import { computeOvershoot } from '../animation/overshoot'

/**
 * Which pipeline stages must re-run after a project change (spec §18).
 * Centralizing this here keeps the recompute policy in one tested place
 * instead of scattered across components.
 */
export interface RecomputeFlags {
  layout: boolean
  render: boolean
  frames: boolean
  encode: boolean
}

const NONE: RecomputeFlags = {
  layout: false,
  render: false,
  frames: false,
  encode: false,
}

function merge(a: RecomputeFlags, b: Partial<RecomputeFlags>): RecomputeFlags {
  return {
    layout: a.layout || !!b.layout,
    render: a.render || !!b.render,
    frames: a.frames || !!b.frames,
    encode: a.encode || !!b.encode,
  }
}

function changed(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) !== JSON.stringify(b)
}

/**
 * Classify a change from `prev` -> `next`. Pure; unit-tested.
 *
 * Per spec §18, but with one correctness refinement the naive table misses:
 * stroke/shadow/glow changes alter the SAFE BOX (effect margins, spec §7.3),
 * which can change the fitted font size — so when computed safe margins change
 * we escalate to `layout: true`, not just `render`.
 */
export function classifyChange(prev: EmojiProject, next: EmojiProject): RecomputeFlags {
  if (prev === next) return NONE
  let flags = NONE

  // Text / font / layout / size -> full recompute.
  if (
    changed(prev.text, next.text) ||
    changed(prev.font, next.font) ||
    changed(prev.layout, next.layout) ||
    changed(prev.size, next.size)
  ) {
    flags = merge(flags, { layout: true, render: true, frames: true, encode: true })
  }

  // Style (fill/strokes/shadows/glows/bg/decorations) -> render + frames + encode.
  if (changed(prev.style, next.style)) {
    flags = merge(flags, { render: true, frames: true, encode: true })

    // Escalate to layout if the effect margins (safe box) changed.
    const pm = computeSafeMargins(prev).total
    const nm = computeSafeMargins(next).total
    if (pm !== nm) flags = merge(flags, { layout: true })
  }

  // Animation preset / params / timing -> re-sample frames + encode. The
  // motion reserve (safe box) depends on the actual motion, so when it changes
  // the layout must be re-solved too.
  if (
    changed(prev.animation.preset, next.animation.preset) ||
    changed(prev.animation.params, next.animation.params) ||
    prev.animation.enabled !== next.animation.enabled ||
    prev.animation.direction !== next.animation.direction ||
    prev.animation.hold !== next.animation.hold ||
    prev.animation.phase !== next.animation.phase
  ) {
    flags = merge(flags, { frames: true, encode: true })
    if (
      changed(prev.animation.preset, next.animation.preset) ||
      computeOvershoot(prev) !== computeOvershoot(next)
    ) {
      flags = merge(flags, { layout: true })
    }
  }

  // fps / duration -> frame plan changes -> re-sample + render + encode.
  if (
    prev.animation.fps !== next.animation.fps ||
    prev.animation.durationMs !== next.animation.durationMs
  ) {
    flags = merge(flags, { frames: true, render: true, encode: true })
  }

  // loop -> encode only.
  if (prev.animation.loop !== next.animation.loop) {
    flags = merge(flags, { encode: true })
  }

  // Export format -> encode only.
  if (prev.export.format !== next.export.format) {
    flags = merge(flags, { encode: true })
  }

  // Final size -> layout + render + frames + encode.
  if (
    prev.export.finalWidth !== next.export.finalWidth ||
    prev.export.finalHeight !== next.export.finalHeight
  ) {
    flags = merge(flags, { layout: true, render: true, frames: true, encode: true })
  }

  // Render scale -> render + frames + encode (layout is scale-independent).
  if (prev.export.renderScale !== next.export.renderScale) {
    flags = merge(flags, { render: true, frames: true, encode: true })
  }

  // Optimize-for -> encode only.
  if (prev.export.optimizeFor !== next.export.optimizeFor) {
    flags = merge(flags, { encode: true })
  }

  return flags
}
