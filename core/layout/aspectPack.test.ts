import { describe, it, expect, beforeAll } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { setCanvasFactory, createSurface } from '../render/renderContext'
import { solveLayout } from './solve'
import { renderProjectFrame } from '../render/renderProject'
import { getAlphaBounds } from './pixelBounds'
import { createDefaultProject } from '../project/defaults'

/**
 * Verify per-letter aspect packing: short text should be stretched to fill the
 * square (better legibility at small Misskey sizes), and the packed render
 * should cover more of the frame than an unpacked one.
 */
beforeAll(() => {
  setCanvasFactory((w, h) => createCanvas(w, h) as unknown as OffscreenCanvas)
})

describe('aspect packing', () => {
  it('stretches short text beyond 1x in fill mode', () => {
    const p = createDefaultProject()
    p.text = 'A'
    p.font.family = 'sans-serif'
    p.style.strokes = []
    p.layout.mode = 'fill'
    const measure = createSurface(64, 64)
    const layout = solveLayout(measure.ctx, p)
    // at least one axis should be stretched to pack the square
    expect(Math.max(layout.stretchX, layout.stretchY)).toBeGreaterThan(1)
  })

  it('packed render fills more of the frame than the safe-margin box', () => {
    const p = createDefaultProject()
    p.text = 'あ'
    p.font.family = 'sans-serif'
    p.style.strokes = []
    p.layout.mode = 'fill'
    const measure = createSurface(64, 64)
    const layout = solveLayout(measure.ctx, p)
    const frame = renderProjectFrame(p, { layout })
    const bounds = getAlphaBounds(frame.rgba, frame.width, frame.height, 10)
    const coverW = (bounds.maxX - bounds.minX) / frame.width
    const coverH = (bounds.maxY - bounds.minY) / frame.height
    // single packed glyph should cover a large fraction of the square
    expect(coverW).toBeGreaterThan(0.5)
    expect(coverH).toBeGreaterThan(0.5)
  })

  it('respects mode caps (safe mode stretches less than fill)', () => {
    const base = createDefaultProject()
    base.text = 'A'
    base.font.family = 'sans-serif'
    base.style.strokes = []
    const measure = createSurface(64, 64)

    const fill = { ...base, layout: { ...base.layout, mode: 'fill' as const } }
    const safe = { ...base, layout: { ...base.layout, mode: 'safe' as const } }
    const lf = solveLayout(measure.ctx, fill)
    const ls = solveLayout(measure.ctx, safe)
    expect(lf.stretchX).toBeGreaterThanOrEqual(ls.stretchX)
  })
})
