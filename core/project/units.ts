/**
 * Style geometry is stored as a FRACTION of the emoji's canvas size, not in
 * pixels, so a project looks identical at every export size: a 256×256 export
 * is a true 2× enlargement of the 128×128 one (same relative point size, same
 * relative outline thickness).
 *
 * The UI still speaks pixels — it shows values at a 128 px reference — because
 * "6 px outline" is easier to reason about than "0.0469 of the canvas".
 */

/** The canvas size the UI's pixel numbers refer to. */
export const REFERENCE_SIZE = 128

/** Fraction (of canvas size) -> px on a canvas of `size`. */
export function fractionToPx(fraction: number, size: number): number {
  return fraction * size
}

/** px on a canvas of `size` -> fraction of canvas size. */
export function pxToFraction(px: number, size: number): number {
  return size > 0 ? px / size : 0
}

/** Fraction -> the pixel value shown in the UI (at the 128 px reference). */
export function fractionToRefPx(fraction: number): number {
  return fraction * REFERENCE_SIZE
}

/** UI pixel value (at the 128 px reference) -> stored fraction. */
export function refPxToFraction(px: number): number {
  return px / REFERENCE_SIZE
}

/**
 * The canvas dimension style fractions are resolved against. Emojis are square
 * in practice; using the smaller side keeps effects inside a non-square canvas.
 */
export function styleBasis(width: number, height: number): number {
  return Math.min(width, height)
}
