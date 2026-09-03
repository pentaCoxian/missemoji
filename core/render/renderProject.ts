import type { EmojiProject } from '../project/schema'
import type { LayoutResult } from '../layout/types'
import type { RenderFrame, Bounds } from '../types'
import type { FrameState } from '../animation/model'
import { IDENTITY_FRAME } from '../animation/model'
import {
  createSurface,
  type RenderSurface,
} from './renderContext'
import { placeText, withBlockStretch } from './renderTextLayer'
import { paintBackground } from './renderDecorations'
import { paintShadows } from '../effects/shadow'
import { paintGlows } from '../effects/glow'
import { paintStrokes } from '../effects/stroke'
import { paintFill } from '../effects/fill'
import { getAlphaBounds } from '../layout/pixelBounds'
import { downscaleTo } from './downscale'

export interface RenderOptions {
  /** A resolved layout (final px). */
  layout: LayoutResult
  /** Optional animation frame state (defaults to identity for static). */
  frame?: FrameState
  /** Stable crop box across animation frames (render px) to avoid jitter. */
  cropBounds?: Bounds | null
  delayMs?: number
}

/**
 * Render a project to a high-res surface, compose all layers in canonical order
 * (spec §9), then crop + downscale to the final size. Returns a RenderFrame.
 *
 * The same code path serves both static (no frame) and one animation frame.
 */
export function renderProjectFrame(
  project: EmojiProject,
  opts: RenderOptions,
): RenderFrame {
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
  const placement = placeText(
    ctx,
    project.font,
    project.layout,
    opts.layout,
    scale,
    { x: 0, y: 0, w: renderW, h: renderH },
  )

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
    paintFill(
      ctx,
      project.font,
      placement,
      project.style.fill,
      frame.paint.gradientOffset,
    )
  })

  ctx.restore()

  // --- crop + downscale ---
  return cropAndDownscale(surface, finalW, finalH, opts.cropBounds, opts.delayMs ?? 0)
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
 * Crop the rendered surface to visible content (or a provided stable crop box),
 * recenter into a square, then downscale to final size. Returns RGBA.
 */
function cropAndDownscale(
  surface: RenderSurface,
  finalW: number,
  finalH: number,
  cropBounds: Bounds | null | undefined,
  delayMs: number,
): RenderFrame {
  const renderW = surface.width
  const renderH = surface.height

  // We downscale the full surface (already correctly placed/centered by layout)
  // rather than tightly cropping — the layout solver already centered content
  // within the safe box. cropBounds is reserved for animation stable-crop use.
  void cropBounds

  const out = downscaleTo(surface.canvas, renderW, renderH, finalW, finalH)
  const img = out.ctx.getImageData(0, 0, finalW, finalH)
  return {
    rgba: img.data,
    width: finalW,
    height: finalH,
    delayMs,
  }
}

/** Compute alpha bounds of a rendered surface (used by analyze-bounds). */
export function computeRenderBounds(
  surface: RenderSurface,
  threshold = 0,
): Bounds {
  const img = surface.ctx.getImageData(0, 0, surface.width, surface.height)
  return getAlphaBounds(img.data, surface.width, surface.height, threshold)
}
