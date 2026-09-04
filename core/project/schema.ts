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

/**
 * GEOMETRY UNITS: every length in a StyleSpec / LayoutSpec below is a FRACTION
 * of the emoji canvas size (see core/project/units.ts), never a pixel count.
 * That is what makes a 256×256 export a true 2× enlargement of the 128×128 one
 * — same relative point size, same relative outline thickness. The UI converts
 * to and from pixels at a 128 px reference.
 */

export interface StrokeSpec {
  /** outline width, as a fraction of canvas size */
  width: number
  color: string
}

export interface ShadowSpec {
  color: string
  /** blur radius, as a fraction of canvas size */
  blur: number
  /** offsets, as fractions of canvas size */
  offsetX: number
  offsetY: number
}

export interface GlowSpec {
  color: string
  /** glow reach, as a fraction of canvas size */
  radius: number
  /** 0..1 intensity multiplier (animatable). */
  intensity: number
}

export type BackgroundSpec =
  | { type: 'solid'; color: string }
  /** `radius` and `padding` are fractions of canvas size */
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
  /** letter spacing, as a fraction of canvas size */
  letterSpacing: number
  /** multiple of the font size (already resolution-independent) */
  lineHeight: number
  variableAxes?: Record<string, number>
}

export interface LayoutSpec {
  mode: LayoutMode
  align: Align
  verticalAlign: VerticalAlign
  /** inner margin, as a fraction of canvas size */
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

export type AnimDirection = 'forward' | 'reverse' | 'pingpong'

export interface AnimationSpec {
  enabled: boolean
  /** preset id from core/animation/presets.ts */
  preset: string
  durationMs: number
  fps: number
  loop: boolean
  direction: AnimDirection
  /** fraction of the loop spent at rest, 0..0.5 */
  hold: number
  /** loop start offset, 0..1 */
  phase: number
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

/** Bump when the shape changes; core/project/migrate.ts upgrades old JSON. */
export const PROJECT_VERSION = 3

export interface EmojiProject {
  version: typeof PROJECT_VERSION
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
