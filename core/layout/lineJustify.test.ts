import { describe, it, expect, beforeAll } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { setCanvasFactory, createSurface } from '../render/renderContext'
import { computeLineScales, justifyTargetWidth, applyLineJustify } from './lineJustify'
import { solveLayout } from './solve'
import { placeText } from '../render/renderTextLayer'
import { createDefaultProject } from '../project/defaults'
import type { EmojiProject } from '../project/schema'
import type { LayoutResult } from './types'

beforeAll(() => {
  setCanvasFactory((w, h) => createCanvas(w, h) as unknown as HTMLCanvasElement)
})

/** A layout stub with the line widths under test. */
function layoutWith(widths: number[]): LayoutResult {
  return {
    fontSize: 100,
    lines: widths.map((w) => ({ clusters: ['x'], width: w, ascent: 80, descent: 20 })),
    blockHeight: widths.length * 100,
    blockWidth: Math.max(...widths, 0),
    stretchX: 1,
    stretchY: 1,
    pixelBounds: null,
    warnings: [],
  }
}

describe('computeLineScales', () => {
  it('scales every line to the target width', () => {
    // wide limits so the arithmetic, not the clamp, is what is under test
    const wide = { min: 0.1, max: 10 }
    expect(computeLineScales([100, 50, 200], 200, wide)).toEqual([2, 4, 1])
  })

  it('clamps so a lone narrow glyph does not become a banner', () => {
    // 10 -> 200 would be 20x; the default cap is 3
    expect(computeLineScales([10, 200], 200)[0]).toBe(3)
  })

  it('clamps condensing too', () => {
    expect(computeLineScales([1000], 100, { min: 0.5, max: 3 })).toEqual([0.5])
  })

  it('leaves empty or zero-width lines alone rather than dividing by zero', () => {
    const out = computeLineScales([0, 100], 100)
    expect(out[0]).toBe(1)
    expect(Number.isFinite(out[1]!)).toBe(true)
  })

  it('is a no-op when the target width is not positive', () => {
    expect(computeLineScales([10, 20], 0)).toEqual([1, 1])
  })
})

describe('justifyTargetWidth', () => {
  it('is the widest line, so the block keeps the size the fit proved', () => {
    expect(justifyTargetWidth([30, 120, 75])).toBe(120)
  })

  it('is 0 for no lines', () => {
    expect(justifyTargetWidth([])).toBe(0)
  })
})

describe('applyLineJustify', () => {
  it('does nothing when disabled', () => {
    expect(applyLineJustify(layoutWith([50, 100]), false).lineScales).toBeUndefined()
  })

  it('does nothing for a single line, which already is the widest', () => {
    expect(applyLineJustify(layoutWith([50]), true).lineScales).toBeUndefined()
  })

  it('gives the widest line a scale of 1 and widens the rest', () => {
    const out = applyLineJustify(layoutWith([50, 100]), true)
    expect(out.lineScales).toEqual([2, 1])
  })

  it('leaves an already-even block untouched', () => {
    expect(applyLineJustify(layoutWith([100, 100]), true).lineScales).toBeUndefined()
  })
})

/** Lay a project out and report each line's real advance width. */
function lineWidthsOf(project: EmojiProject): number[] {
  const surface = createSurface(project.export.finalWidth, project.export.finalHeight)
  const layout = solveLayout(surface.ctx, project)
  const placement = placeText(surface.ctx, project.font, project.layout, layout, 1, {
    x: 0,
    y: 0,
    w: project.export.finalWidth,
    h: project.export.finalHeight,
  })
  return placement.lineWidths
}

describe('justified layout end to end', () => {
  /** Uneven breaks: a long line over a short one, like なんか / 分割. */
  function uneven(justify: boolean): EmojiProject {
    const p = createDefaultProject()
    p.text = 'なんか\n分割'
    p.layout = { ...p.layout, manualLineBreaks: true, justifyLines: justify }
    return p
  }

  it('leaves lines ragged when the flag is off', () => {
    const widths = lineWidthsOf(uneven(false))
    expect(widths).toHaveLength(2)
    // the 2-character line is clearly narrower than the 3-character one
    expect(widths[1]!).toBeLessThan(widths[0]! * 0.9)
  })

  it('makes every line the same width when the flag is on', () => {
    const widths = lineWidthsOf(uneven(true))
    expect(widths).toHaveLength(2)
    const [a, b] = widths as [number, number]
    expect(Math.abs(a - b)).toBeLessThan(Math.max(a, b) * 0.02)
  })

  it('does not change a block whose lines are already equal', () => {
    const p = createDefaultProject()
    p.text = 'ある\nいう'
    p.layout = { ...p.layout, manualLineBreaks: true, justifyLines: false }
    const plain = lineWidthsOf(p)
    p.layout = { ...p.layout, justifyLines: true }
    const justified = lineWidthsOf(p)
    plain.forEach((w, i) => expect(justified[i]!).toBeCloseTo(w, 5))
  })

  it('keeps the justified block within the canvas', () => {
    const p = uneven(true)
    const widths = lineWidthsOf(p)
    for (const w of widths) expect(w).toBeLessThanOrEqual(p.export.finalWidth)
  })
})
