/**
 * Animation model types (spec §10). A frame's state is a LayerTransform applied
 * around the emoji centre, plus paint modulators.
 *
 * UNITS: every length here is a FRACTION of the final canvas so presets are
 * resolution-independent: `translate.x` is multiplied by the canvas width,
 * `translate.y` by its height, `blur` by the smaller side. The renderer does the
 * multiplication (core/render/renderProject.ts).
 */

export interface LayerTransform {
  /** offset as a fraction of canvas width / height */
  translate: { x: number; y: number }
  scale: { x: number; y: number }
  /** rotation in radians */
  rotate: number
  /** 0..1; applied ONCE to the composed layer (no per-pass double blending) */
  opacity: number
  /** blur radius as a fraction of min(canvas width, height); usually 0 */
  blur: number
}

export interface PaintModulators {
  /** multiplies all glow intensities */
  glowIntensity: number
  /** multiplies all stroke widths */
  strokeWidthMul: number
  /** added to gradient offset (0..1 wrap) */
  gradientOffset: number
  /** hue rotation of the fill colour(s), degrees */
  hueShift: number
  /** saturation floor (0..1) applied with hueShift so pale fills still cycle */
  minSaturation: number
}

/**
 * Per-character motion for text-specific presets (e.g. wave). Same units as
 * LayerTransform (translate as a canvas fraction); applied around each
 * glyph's visual centre. No per-character opacity: overlapping glyphs would
 * double-blend.
 */
export interface PerCharTransform {
  translate: { x: number; y: number }
  scale: { x: number; y: number }
  /** radians */
  rotate: number
}

export interface CharInfo {
  /** index over the whole text */
  index: number
  count: number
  line: number
  lineCount: number
  indexInLine: number
  lineLength: number
}

export type PerCharFn = (c: CharInfo) => {
  translate?: { x: number; y: number }
  scale?: { x: number; y: number }
  rotate?: number
}

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
  hueShift: 0,
  minSaturation: 0,
}

export const IDENTITY_FRAME: FrameState = {
  layer: IDENTITY_TRANSFORM,
  paint: IDENTITY_PAINT,
}
