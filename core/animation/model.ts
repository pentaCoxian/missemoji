/**
 * Animation model types (spec §10). A frame's state is a LayerTransform applied
 * around the emoji centre, plus paint modulators. Defined in M1 so the renderer
 * can accept an optional transform from the start; the preset registry that
 * produces these lands in M5.
 */

export interface LayerTransform {
  translate: { x: number; y: number }
  scale: { x: number; y: number }
  /** rotation in radians */
  rotate: number
  /** 0..1 */
  opacity: number
  /** blur in px (render-space; usually 0) */
  blur: number
}

export interface PaintModulators {
  /** multiplies all glow intensities */
  glowIntensity: number
  /** multiplies all stroke widths */
  strokeWidthMul: number
  /** added to gradient offset (0..1 wrap) */
  gradientOffset: number
}

/** Per-character transform function for text-specific presets (e.g. wave). */
export type PerCharFn = (charIndex: number, charCount: number) => Partial<LayerTransform>

export interface FrameState {
  layer: LayerTransform
  paint: PaintModulators
  perChar?: PerCharFn
}

export const IDENTITY_TRANSFORM: LayerTransform = {
  translate: { x: 0, y: 0 },
  scale: { x: 1, y: 1 },
  rotate: 0,
  opacity: 1,
  blur: 0,
}

export const IDENTITY_PAINT: PaintModulators = {
  glowIntensity: 1,
  strokeWidthMul: 1,
  gradientOffset: 0,
}

export const IDENTITY_FRAME: FrameState = {
  layer: IDENTITY_TRANSFORM,
  paint: IDENTITY_PAINT,
}
