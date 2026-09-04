import type { EmojiProject } from '../project/schema'
import type { LayoutResult } from '../layout/types'
import type { FrameStats } from '../types'
import { fractionToPx, styleBasis } from '../project/units'

/**
 * File-size estimation + quality/size warnings (spec §16). Warnings cover both
 * readability (text too small, outline too thick, glow drowning text) and size
 * (file too large, too many frames, loop too fast). Pure; surfaced in the UI.
 */

export interface Warning {
  level: 'info' | 'warn' | 'error'
  message: string
}

/** Misskey emoji files are often capped around a few hundred KB by instances. */
const SOFT_SIZE_LIMIT = 256 * 1024
const HARD_SIZE_LIMIT = 1024 * 1024

/** Rough pre-encode estimate: frameCount * pixels * bytes/pixel * compression. */
export function estimateBytes(project: EmojiProject, frameCount: number): number {
  const px = project.export.finalWidth * project.export.finalHeight
  const compression = project.export.format === 'gif' ? 0.4 : 0.55
  return Math.round(px * 4 * frameCount * compression)
}

/**
 * Better estimate from rendered-frame stats: only opaque pixels cost bytes
 * (transparent emoji compress extremely well) and duplicate frames are merged
 * by optimizeFrames. Bytes-per-opaque-pixel are empirical for zlib'd RGBA
 * (APNG) and LZW'd 8-bit indices (GIF).
 */
export function estimateBytesFromStats(project: EmojiProject, stats: FrameStats[]): number {
  if (stats.length === 0) return estimateBytes(project, 1)
  const unique = new Set(stats.map((s) => s.hash)).size
  const avgOpaque = stats.reduce((sum, s) => sum + s.opaquePixels, 0) / stats.length
  const perPixel = project.export.format === 'gif' ? 1.0 : 1.4
  return Math.round(unique * avgOpaque * perPixel + 300)
}

export function buildWarnings(
  project: EmojiProject,
  layout: LayoutResult | null,
  frameCount: number,
  /** actual encoded size, or a stats-based estimate; falls back to a rough guess */
  knownBytes?: number,
  missingGlyphs: string[] = [],
): Warning[] {
  const warnings: Warning[] = []
  const bytes = knownBytes ?? estimateBytes(project, frameCount)

  // --- size ---
  if (bytes > HARD_SIZE_LIMIT) {
    warnings.push({
      level: 'error',
      message: `File is very large (~${fmtKB(bytes)}). Reduce frames, FPS, or size.`,
    })
  } else if (bytes > SOFT_SIZE_LIMIT) {
    warnings.push({
      level: 'warn',
      message: `File may exceed some Misskey instance limits (~${fmtKB(bytes)}).`,
    })
  }

  if (frameCount > 30) {
    warnings.push({
      level: 'warn',
      message: `${frameCount} frames is a lot — consider lowering FPS or duration.`,
    })
  }

  if (project.animation.enabled && project.animation.durationMs < 500) {
    warnings.push({
      level: 'info',
      message: 'Loop is fast (<500ms); it may look frantic at small sizes.',
    })
  }

  // --- readability ---
  if (layout) {
    // Effective on-screen size of the fitted text at the smallest preview (24px).
    const ratio = 24 / project.export.finalWidth
    const effectivePx = layout.fontSize * ratio
    if (effectivePx < 6) {
      warnings.push({
        level: 'warn',
        message: 'Text may be unreadable at 24px. Use shorter text or Impact mode.',
      })
    }

    // style lengths are fractions of canvas size; compare in final px
    const basis = styleBasis(project.export.finalWidth, project.export.finalHeight)
    const maxStroke = project.style.strokes.reduce(
      (m, s) => Math.max(m, fractionToPx(s.width, basis)),
      0,
    )
    if (maxStroke > layout.fontSize * 0.25) {
      warnings.push({
        level: 'warn',
        message: 'Outline is thick relative to the text; it may close up small glyphs.',
      })
    }

    const maxGlow = project.style.glows.reduce(
      (m, g) => Math.max(m, fractionToPx(g.radius, basis)),
      0,
    )
    if (maxGlow > layout.fontSize * 0.6) {
      warnings.push({
        level: 'info',
        message: 'Glow is large; it may wash out the text edges.',
      })
    }
  }

  if (missingGlyphs.length > 0) {
    warnings.push({
      level: 'warn',
      message: `Font is missing ${missingGlyphs.length} glyph(s): ${missingGlyphs.join(' ')}`,
    })
  }

  return warnings
}

function fmtKB(bytes: number): string {
  return `${Math.round(bytes / 1024)}KB`
}
