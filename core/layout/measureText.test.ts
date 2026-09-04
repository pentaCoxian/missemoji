import { describe, it, expect, beforeAll } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { setCanvasFactory, createSurface } from '../render/renderContext'
import { measureRun, clearMeasureCache } from './measureText'
import { createDefaultProject } from '../project/defaults'
import type { FontSpec } from '../project/schema'

/**
 * Font metrics must be taken at face value. A glyph sitting exactly on the
 * baseline reports `actualBoundingBoxDescent === 0`, and one whose ink stops
 * above it reports a NEGATIVE descent. Both are real measurements. Treating
 * either as "missing" and substituting the font's own descent (~21% of the
 * size) inflates the measured block and throws vertical centring off by tens
 * of pixels — which is what used to happen with Arial and Helvetica.
 */
beforeAll(() => setCanvasFactory((w, h) => createCanvas(w, h) as unknown as OffscreenCanvas))

const font = (family: string): FontSpec => ({ ...createDefaultProject().font, family })

describe('measureRun', () => {
  it('does not substitute a font descent for text that sits on the baseline', () => {
    const ctx = createSurface(400, 400).ctx
    const size = 100
    for (const family of ['Arial', 'Helvetica', 'sans-serif']) {
      clearMeasureCache()
      const m = measureRun(ctx, font(family), size, ['A', 'B', 'C'])
      // "ABC" has no descenders: its descent is ~0, never the font's ~21%
      expect(Math.abs(m.descent), `${family} descent`).toBeLessThan(size * 0.1)
      expect(m.ascent, `${family} ascent`).toBeGreaterThan(size * 0.5)
    }
  })

  it('still reports a real descent for text that has one', () => {
    const ctx = createSurface(400, 400).ctx
    clearMeasureCache()
    const withTail = measureRun(ctx, font('Arial'), 100, ['A', 'g'])
    clearMeasureCache()
    const without = measureRun(ctx, font('Arial'), 100, ['A', 'B', 'C'])
    expect(withTail.descent).toBeGreaterThan(without.descent + 5)
  })

  it('scales linearly with font size', () => {
    const ctx = createSurface(400, 400).ctx
    clearMeasureCache()
    const small = measureRun(ctx, font('Arial'), 50, ['A', 'g'])
    clearMeasureCache()
    const large = measureRun(ctx, font('Arial'), 100, ['A', 'g'])
    expect(large.ascent / small.ascent).toBeCloseTo(2, 0)
    expect(large.width / small.width).toBeCloseTo(2, 0)
  })

  it('returns zeroes for an empty run rather than a fabricated box', () => {
    const ctx = createSurface(400, 400).ctx
    clearMeasureCache()
    const m = measureRun(ctx, font('Arial'), 100, [])
    expect(m).toEqual({ width: 0, ascent: 0, descent: 0 })
  })

  it('applies letter spacing between clusters only', () => {
    const ctx = createSurface(400, 400).ctx
    clearMeasureCache()
    const plain = measureRun(ctx, font('Arial'), 100, ['A', 'B', 'C'], 0)
    clearMeasureCache()
    const spaced = measureRun(ctx, font('Arial'), 100, ['A', 'B', 'C'], 10)
    // three clusters => two gaps
    expect(spaced.width - plain.width).toBeCloseTo(20, 0)
  })
})
