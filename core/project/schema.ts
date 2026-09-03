/**
 * The EmojiProject data model — the single source of truth for an emoji
 * (spec §6). Pure types; the Pinia `project` store imports these rather than
 * redefining them, and workers receive structured-cloned copies.
 */

export type LayoutMode = 'fit' | 'fill' | 'safe' | 'compact' | 'jp-balanced' | 'impact'

export type Align = 'center' | 'left' | 'right'
export type VerticalAlign = 'middle' | 'top' | 'bottom'

export type ExportFormat = 'png' | 'apng' | 'gif'
export type OptimizeFor = 'quality' | 'size' | 'balanced'

/** A color stop for gradient fills. position in [0, 1]. */
export interface GradientStop {
  position: number
  color: string
}

export type FillSpec =
  | { type: 'solid'; color: string }
  | {
      type: 'linear-gradient'
      stops: GradientStop[]
      /** angle in degrees, 0 = left→right. Animatable via gradientOffset. */
      angle: number
    }

export interface StrokeSpec {
  width: number
  color: string
}

export interface ShadowSpec {
  color: string
  blur: number
  offsetX: number
  offsetY: number
}

export interface GlowSpec {
  color: string
  radius: number
  /** 0..1 intensity multiplier (animatable). */
  intensity: number
}

export type BackgroundSpec =
  | { type: 'solid'; color: string }
  | { type: 'blob'; color: string; radius: number; padding: number }

/** Decorations are defined now but only a subset renders before Phase 4. */
export interface DecorationSpec {
  kind: string
  params: Record<string, number | string | boolean>
}

export interface FontSpec {
  family: string
  weight: number
  style: 'normal' | 'italic'
  letterSpacing: number
  lineHeight: number
  variableAxes?: Record<string, number>
}

export interface LayoutSpec {
  mode: LayoutMode
  align: Align
  verticalAlign: VerticalAlign
  padding: number
  manualLineBreaks: boolean
}

export interface StyleSpec {
  fill: FillSpec
  strokes: StrokeSpec[]
  shadows: ShadowSpec[]
  glows: GlowSpec[]
  background: BackgroundSpec | null
  decorations: DecorationSpec[]
}

export interface AnimationSpec {
  enabled: boolean
  /** preset id from core/animation/presets.ts */
  preset: string
  durationMs: number
  fps: number
  loop: boolean
  params: Record<string, number | string | boolean>
}

export interface ExportSpec {
  format: ExportFormat
  finalWidth: number
  finalHeight: number
  /** internal render = final * renderScale (spec §5, §12). */
  renderScale: number
  optimizeFor: OptimizeFor
}

export interface EmojiProject {
  version: 1
  text: string
  size: {
    width: number
    height: number
  }
  font: FontSpec
  layout: LayoutSpec
  style: StyleSpec
  animation: AnimationSpec
  export: ExportSpec
}
