/**
 * Shared geometry & pixel types used across layout, render, animation and export.
 * Pure data — no framework imports.
 */

/** Axis-aligned pixel bounds (inclusive min, exclusive max). Empty when isEmpty. */
export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/** RGBA color, channels 0..255, alpha 0..1. */
export interface RGBA {
  r: number
  g: number
  b: number
  a: number
}

/** A single rendered animation frame, ready for an encoder. */
export interface RenderFrame {
  rgba: Uint8ClampedArray
  width: number
  height: number
  delayMs: number
}

/** One entry in an animation sampling plan (see core/animation/frames.ts). */
export interface FramePlan {
  frameIndex: number
  /** progress = frameIndex / frameCount, in [0, 1). */
  progress: number
  delayMs: number
}

export const EMPTY_BOUNDS: Bounds = {
  minX: Infinity,
  minY: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
}

export function boundsWidth(b: Bounds): number {
  return Math.max(0, b.maxX - b.minX)
}

export function boundsHeight(b: Bounds): number {
  return Math.max(0, b.maxY - b.minY)
}

export function boundsIsEmpty(b: Bounds): boolean {
  return b.maxX < b.minX || b.maxY < b.minY
}

/** Union of two bounds (used for stable animation crop boxes). */
export function unionBounds(a: Bounds, b: Bounds): Bounds {
  if (boundsIsEmpty(a)) return { ...b }
  if (boundsIsEmpty(b)) return { ...a }
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }
}
