import type { EmojiProject } from '../project/schema'
import type { LayoutResult } from '../layout/types'
import type { RenderFrame } from '../types'
import type { FrameState } from '../animation/model'
import { IDENTITY_FRAME } from '../animation/model'
import { createSurface, type Ctx2D, type RenderSurface } from './renderContext'
import { placeText, withBlockStretch } from './renderTextLayer'
import { paintBackground } from './renderDecorations'
import { paintShadows } from '../effects/shadow'
import { paintGlows } from '../effects/glow'
import { paintStrokes } from '../effects/stroke'
import { paintFill } from '../effects/fill'
import { blurredCopy } from '../effects/blur'
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
 * Layer order: background (static, never transformed) → the emoji layer under
 * the frame's transform (shadow → glow → stroke → fill). When the frame has
 * opacity < 1 or blur > 0 the whole thing is painted to a temp surface and
 * composited ONCE, so overlapping passes never double-blend.
 */
export function renderProjectFrame(project: EmojiProject, opts: RenderOptions): RenderFrame {
  const scale = project.export.renderScale
  const finalW = project.export.finalWidth
  const finalH = project.export.finalHeight
  const renderW = finalW * scale
  const renderH = finalH * scale
  const frame = opts.frame ?? IDENTITY_FRAME

  const surface = createSurface(renderW, renderH)
  surface.ctx.clearRect(0, 0, renderW, renderH)

  const opacity = Math.min(1, Math.max(0, frame.layer.opacity))
  const blurPx = Math.max(0, frame.layer.blur) * Math.min(renderW, renderH)
  const needsComposite = opacity < 1 || blurPx >= 0.5
  const target = needsComposite ? createSurface(renderW, renderH) : surface

  // --- background: static under motion, fades with the layer ---
  paintBackground(target.ctx, project.style.background, renderW, renderH)

  // --- emoji layer under the whole-frame transform ---
  target.ctx.save()
  applyLayerTransform(target.ctx, frame, renderW, renderH)
  paintEmojiLayer(target.ctx, project, opts.layout, frame, scale, renderW, renderH)
  target.ctx.restore()

  if (needsComposite) {
    const layer = blurPx >= 0.5 ? blurredCopy(target.canvas, renderW, renderH, blurPx) : target
    surface.ctx.globalAlpha = opacity
    surface.ctx.drawImage(layer.canvas, 0, 0)
    surface.ctx.globalAlpha = 1
  }

  return downscaleFrame(surface, finalW, finalH, opts.delayMs ?? 0)
}

/** Shadow → glow → stroke → fill, all sharing one glyph placement. */
function paintEmojiLayer(
  ctx: Ctx2D,
  project: EmojiProject,
  layout: LayoutResult,
  frame: FrameState,
  scale: number,
  renderW: number,
  renderH: number,
) {
  const fullBox = { x: 0, y: 0, w: renderW, h: renderH }

  // Place text geometry once; reused by every pass for perfect registration.
  const placement = placeText(ctx, project.font, project.layout, layout, scale, fullBox)

  paintShadows(ctx, project.font, placement, project.style.shadows, scale)

  const glows = project.style.glows.map((g) => ({
    ...g,
    intensity: g.intensity * frame.paint.glowIntensity,
  }))
  paintGlows(ctx, project.font, placement, glows, scale)

  // Strokes + fill are drawn under ONE block stretch so the glyph shapes and
  // the fill gradient pack the square coherently (per-letter aspect packing).
  // Shadow/glow apply the same stretch on their own temp surfaces.
  const strokes = project.style.strokes.map((s) => ({
    ...s,
    width: s.width * frame.paint.strokeWidthMul,
  }))
  withBlockStretch(ctx, placement, fullBox, () => {
    paintStrokes(ctx, project.font, placement, strokes, scale)
    paintFill(ctx, project.font, placement, project.style.fill, frame.paint.gradientOffset)
  })
}

/**
 * Whole-emoji transform around the canvas centre. `translate` is a fraction of
 * the canvas size (see animation/model.ts), so it is scaled here.
 */
function applyLayerTransform(ctx: Ctx2D, frame: FrameState, w: number, h: number) {
  const cx = w / 2
  const cy = h / 2
  ctx.translate(cx + frame.layer.translate.x * w, cy + frame.layer.translate.y * h)
  ctx.rotate(frame.layer.rotate)
  ctx.scale(frame.layer.scale.x, frame.layer.scale.y)
  ctx.translate(-cx, -cy)
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
  const out = downscaleTo(surface.canvas, surface.width, surface.height, finalW, finalH)
  const img = out.ctx.getImageData(0, 0, finalW, finalH)
  return {
    rgba: img.data,
    width: finalW,
    height: finalH,
    delayMs,
  }
}
