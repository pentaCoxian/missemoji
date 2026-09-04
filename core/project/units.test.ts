import { describe, it, expect } from 'vitest'
import {
  REFERENCE_SIZE,
  fractionToPx,
  pxToFraction,
  fractionToRefPx,
  refPxToFraction,
  styleBasis,
} from './units'

describe('style units', () => {
  it('round-trips px <-> fraction at any canvas size', () => {
    for (const size of [64, 128, 256, 512]) {
      for (const px of [0, 4, 6, 24]) {
        expect(fractionToPx(pxToFraction(px, size), size)).toBeCloseTo(px, 10)
      }
    }
  })

  it('the UI reference is 128 px', () => {
    expect(REFERENCE_SIZE).toBe(128)
    expect(refPxToFraction(6)).toBeCloseTo(6 / 128, 10)
    expect(fractionToRefPx(6 / 128)).toBeCloseTo(6, 10)
  })

  it('a fraction produces proportional px, so 256 is a 2x enlargement of 128', () => {
    const outline = refPxToFraction(6)
    expect(fractionToPx(outline, 128)).toBeCloseTo(6, 10)
    expect(fractionToPx(outline, 256)).toBeCloseTo(12, 10)
  })

  it('resolves against the smaller side of a non-square canvas', () => {
    expect(styleBasis(128, 128)).toBe(128)
    expect(styleBasis(256, 128)).toBe(128)
    expect(styleBasis(128, 256)).toBe(128)
  })

  it('guards against a zero-size canvas', () => {
    expect(pxToFraction(6, 0)).toBe(0)
  })
})
