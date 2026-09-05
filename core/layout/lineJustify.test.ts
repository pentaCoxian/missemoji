import { describe, it, expect, beforeAll } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { setCanvasFactory, createSurface } from '../render/renderContext'
import {
  computeLineSizes,
  justifyTargetWidth,
  justifiedBlockHeight,
  justifiedLeading,
  applyLineJustify,
  DEFAULT_JUSTIFY_LIMITS,
} from './lineJustify'
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

describe('computeLineSizes', () => {
  it('sizes every line to the target width', () => {
    // wide limits so the arithmetic, not the clamp, is what is under test
    const wide = { min: 0.1, max: 10 }
    expect(computeLineSizes([100, 50, 200], 200, wide)).toEqual([2, 4, 1])
  })

  it('clamps so a lone narrow line does not dominate the block', () => {
    // 10 -> 200 would be 20x; the default cap holds it back
    expect(computeLineSizes([10, 200], 200)[0]).toBe(DEFAULT_JUSTIFY_LIMITS.max)
  })

  it('clamps shrinking too', () => {
    expect(computeLineSizes([1000], 100, { min: 0.5, max: 3 })).toEqual([0.5])
  })

  it('leaves empty or zero-width lines alone rather than dividing by zero', () => {
    const out = computeLineSizes([0, 100], 100)
    expect(out[0]).toBe(1)
    expect(Number.isFinite(out[1]!)).toBe(true)
  })

  it('is a no-op when the target width is not positive', () => {
    expect(computeLineSizes([10, 20], 0)).toEqual([1, 1])
  })
})

describe('justifiedLeading', () => {
  const lines = [
    { ascent: 80, descent: 20 },
    { ascent: 80, descent: 20 },
  ]

  it('clears the ink of both lines, so a bigger line cannot reach back', () => {
    // descent 20*2 + next ascent 80*1 = 120, and lineHeight 1 adds no gap
    expect(justifiedLeading(lines, [2, 1], 100, 1, 0)).toBe(120)
    // a much bigger line below needs a correspondingly bigger gap
    expect(justifiedLeading(lines, [1, 3], 100, 1, 0)).toBe(260)
  })

  it('adds the SAME breathing space to every gap, so spacing reads as even', () => {
    // lineHeight 1.5 on a base of 100 adds 50 to each gap, whatever the sizes
    expect(justifiedLeading(lines, [2, 1], 100, 1.5, 0)).toBe(120 + 50)
    expect(justifiedLeading(lines, [1, 3], 100, 1.5, 0)).toBe(260 + 50)
  })

  it('has nothing to clear after the last line', () => {
    expect(justifiedLeading(lines, [2, 1], 100, 1, 1)).toBe(100)
  })
})

describe('justifiedBlockHeight', () => {
  // Measured as real ink: the leadings BETWEEN baselines (each set by the line
  // the gap follows), plus the first ascent above and the last descent below.
  const lines = [
    { ascent: 80, descent: 20 },
    { ascent: 80, descent: 20 },
  ]

  it('separates baselines by the leading of the line each gap follows', () => {
    // one gap driven by line 0 at size 1 (100), + ascent 80 + descent 20
    expect(justifiedBlockHeight(lines, [1, 1], 100, 1)).toBe(200)
  })

  it('scales the first ascent and last descent by their own line sizes', () => {
    // gap = clearance 20*2 + 80*1 = 120, plus first ascent 80*2, last descent 20
    expect(justifiedBlockHeight(lines, [2, 1], 100, 1)).toBe(300)
  })

  it('is just the ink of a single line', () => {
    expect(justifiedBlockHeight([lines[0]!], [1], 100, 1)).toBe(100)
  })

  it('is 0 with no lines', () => {
    expect(justifiedBlockHeight([], [], 100, 1)).toBe(0)
  })
})

describe('justifyTargetWidth', () => {
  it('is the box width, so long lines shrink and short ones grow', () => {
    expect(justifyTargetWidth([30, 120, 75], 200)).toBe(200)
  })
})

describe('applyLineJustify', () => {
  /** A box tall enough that nothing has to shrink to fit. */
  const ROOMY = { w: 200, h: 100000 }

  it('does nothing when disabled', () => {
    expect(applyLineJustify(layoutWith([50, 100]), false, ROOMY, 1).lineSizes).toBeUndefined()
  })

  it('does nothing for a single line, which the uniform fit already sized', () => {
    expect(applyLineJustify(layoutWith([50]), true, ROOMY, 1).lineSizes).toBeUndefined()
  })

  it('sizes every line toward the box: short lines grow, long lines shrink', () => {
    // box 200: a 50-wide line needs 4x, a 400-wide line needs 0.5x
    const out = applyLineJustify(layoutWith([50, 400]), true, ROOMY, 1)
    expect(out.lineSizes![0]!).toBeGreaterThan(1)
    expect(out.lineSizes![1]!).toBeLessThan(1)
  })

  it('leaves per-line metrics at the BASE size for the renderer to scale', () => {
    // The renderer re-measures each line at fontSize * lineSizes[i], so baking
    // the multiplier into these would apply it twice.
    const out = applyLineJustify(layoutWith([100, 200]), true, ROOMY, 1)
    expect(out.lines[0]!.width).toBeCloseTo(100, 6)
    expect(out.lines[0]!.ascent).toBeCloseTo(80, 6)
  })

  it('shrinks the whole block when the bigger lines overflow the box height', () => {
    const roomy = applyLineJustify(layoutWith([50, 100]), true, ROOMY, 1)
    const tight = applyLineJustify(layoutWith([50, 100]), true, { w: 200, h: 150 }, 1)
    expect(tight.blockHeight).toBeLessThanOrEqual(150 + 1e-9)
    // the RATIO between lines is what the style is about; it must survive
    const ratio = (l: typeof tight) => l.lineSizes![0]! / l.lineSizes![1]!
    expect(ratio(tight)).toBeCloseTo(ratio(roomy), 6)
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

  it('keeps equal lines equal (they scale together, not apart)', () => {
    const p = createDefaultProject()
    p.text = 'ある\nいう'
    p.layout = { ...p.layout, manualLineBreaks: true, justifyLines: true }
    const [a, b] = lineWidthsOf(p) as [number, number]
    expect(Math.abs(a - b)).toBeLessThan(Math.max(a, b) * 0.02)
  })

  it('never lets a bigger line reach back over the one above it', () => {
    // The failure this guards: leading keyed to the PREVIOUS line only, so a
    // small line followed by a much larger one advanced too little and the big
    // line's tall ascent crossed its predecessor.
    for (const text of ['なんか\nいい感じにして\n分割', 'MAKE\nIT\nBIGGER', 'あ\nとてもながい']) {
      const p = createDefaultProject()
      p.text = text
      p.layout = { ...p.layout, manualLineBreaks: true, justifyLines: true, mode: 'impact' }
      const surface = createSurface(p.export.finalWidth, p.export.finalHeight)
      const layout = solveLayout(surface.ctx, p)
      const placement = placeText(surface.ctx, p.font, p.layout, layout, 1, {
        x: 0,
        y: 0,
        w: p.export.finalWidth,
        h: p.export.finalHeight,
      })
      const rows = new Map<number, { top: number; bottom: number }>()
      for (const c of placement.clusters) {
        const top = c.y - c.ascent
        const bottom = c.y + c.descent
        const prev = rows.get(c.line)
        rows.set(c.line, {
          top: Math.min(prev?.top ?? top, top),
          bottom: Math.max(prev?.bottom ?? bottom, bottom),
        })
      }
      const ordered = [...rows].sort((a, b) => a[0] - b[0]).map(([, r]) => r)
      ordered.forEach((r, i) => {
        if (i === 0) return
        expect(r.top).toBeGreaterThanOrEqual(ordered[i - 1]!.bottom - 0.5)
      })
    }
  })

  it('keeps the justified block within the canvas', () => {
    const p = uneven(true)
    const widths = lineWidthsOf(p)
    for (const w of widths) expect(w).toBeLessThanOrEqual(p.export.finalWidth)
  })
})
