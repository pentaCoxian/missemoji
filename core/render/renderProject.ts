import type { EmojiProject } from '../project/schema'
import type { LayoutResult } from '../layout/types'
import type { RenderFrame } from '../types'
import type { FrameState } from '../animation/model'
import { IDENTITY_FRAME } from '../animation/model'
import { createSurface, type RenderSurface } from './renderContext'
import { placeText, withBlockStretch } from './renderTextLayer'
import { paintBackground } from './renderDecorations'
import { paintShadows } from '../effects/shadow'
import { paintGlows } from '../effects/glow'
import { paintStrokes } from '../effects/stroke'
import { paintFill } from '../effects/fill'
import { downscaleTo } from './downscale'

export interface RenderOptions {
  /** A resolved layout (final px). */
  layout: LayoutResult
  /** Optional animation frame state (defaults to identity for static). */
  frame?: FrameState
  delayMs?: number
}

/**
 * Render a project to a high-res surface, compose all layers in canonical order
 * (spec §9), then downscale to the final size. Returns a RenderFrame.
 *
 * The same code path serves both static (no frame) and one animation frame.
 */
export function renderProjectFrame(project: EmojiProject, opts: RenderOptions): RenderFrame {
  const scale = project.export.renderScale
  const finalW = project.export.finalWidth
  const finalH = project.export.finalHeight
  const renderW = finalW * scale
  const renderH = finalH * scale
  const frame = opts.frame ?? IDENTITY_FRAME

  const surface = createSurface(renderW, renderH)
  const ctx = surface.ctx

  // --- 1. clear (transparent) ---
  ctx.clearRect(0, 0, renderW, renderH)

  // --- apply whole-emoji transform around centre ---
  ctx.save()
  applyLayerTransform(ctx, frame, renderW, renderH)

  // --- 2. background ---
  paintBackground(ctx, project.style.background, renderW, renderH)

  // --- place text geometry once; reused by all text passes ---
  const placement = placeText(ctx, project.font, project.layout, opts.layout, scale, {
    x: 0,
    y: 0,
    w: renderW,
    h: renderH,
  })

  // --- 4. shadow ---
  paintShadows(ctx, project.font, placement, project.style.shadows, scale)

  // --- 5. glow (modulated by animation paint) ---
  const glows = project.style.glows.map((g) => ({
    ...g,
    intensity: g.intensity * frame.paint.glowIntensity,
  }))
  paintGlows(ctx, project.font, placement, glows, scale)

  // --- 6 + 7. strokes + fill, drawn under ONE block stretch so the glyph
  // shapes and the fill gradient pack the square coherently (per-letter aspect
  // packing). Shadow/glow apply the same stretch on their own temp surfaces.
  const strokes = project.style.strokes.map((s) => ({
    ...s,
    width: s.width * frame.paint.strokeWidthMul,
  }))
  const fullBox = { x: 0, y: 0, w: renderW, h: renderH }
  withBlockStretch(ctx, placement, fullBox, () => {
    paintStrokes(ctx, project.font, placement, strokes, scale)
    paintFill(ctx, project.font, placement, project.style.fill, frame.paint.gradientOffset)
  })

  ctx.restore()

  // --- downscale ---
  return downscaleFrame(surface, finalW, finalH, opts.delayMs ?? 0)
}

function applyLayerTransform(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frame: FrameState,
  w: number,
  h: number,
) {
  const cx = w / 2
  const cy = h / 2
  ctx.translate(cx + frame.layer.translate.x, cy + frame.layer.translate.y)
  ctx.rotate(frame.layer.rotate)
  ctx.scale(frame.layer.scale.x, frame.layer.scale.y)
  ctx.translate(-cx, -cy)
  ctx.globalAlpha = frame.layer.opacity
}

/**
 * Downscale the full render surface to the final size and read back RGBA. The
 * layout solver already centred the content within the safe box, so no crop is
 * needed (and a per-frame crop would make animation frames jitter).
 */
function downscaleFrame(
  surface: RenderSurface,
  finalW: number,
  finalH: number,
  delayMs: number,
): RenderFrame {
  const renderW = surface.width
  const renderH = surface.height
  const out = downscaleTo(surface.canvas, renderW, renderH, finalW, finalH)
  const img = out.ctx.getImageData(0, 0, finalW, finalH)
  return {
    rgba: img.data,
    width: finalW,
    height: finalH,
    delayMs,
  }
}
