import { describe, it, expect, beforeAll } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { setCanvasFactory, createSurface } from './renderContext'
import { renderProjectFrame } from './renderProject'
import { solveLayout } from '../layout/solve'
import { getAlphaBounds } from '../layout/pixelBounds'
import { createDefaultProject } from '../project/defaults'

/**
 * Headless render verification using @napi-rs/canvas. This exercises the FULL
 * pipeline (solve → place → effects → downscale → RGBA) and asserts on actual
 * pixels — the one thing build/typecheck/unit-math cannot confirm.
 */
beforeAll(() => {
  // @napi-rs/canvas's createCanvas returns a node canvas with getContext('2d').
  setCanvasFactory((w, h) => createCanvas(w, h) as unknown as OffscreenCanvas)
})

function renderText(text: string) {
  const project = createDefaultProject()
  project.text = text
  project.font.family = 'sans-serif' // a font node-canvas definitely has
  project.style.fill = { type: 'solid', color: '#ff0000' }
  project.style.strokes = []
  const measure = createSurface(64, 64)
  const layout = solveLayout(measure.ctx, project)
  const frame = renderProjectFrame(project, { layout })
  return { frame, layout }
}

describe('renderProjectFrame (headless)', () => {
  it('renders visible non-transparent content for text', () => {
    const { frame } = renderText('A')
    expect(frame.width).toBe(128)
    expect(frame.height).toBe(128)
    const bounds = getAlphaBounds(frame.rgba, frame.width, frame.height, 10)
    // there should be visible pixels (not an empty transparent frame)
    expect(bounds.maxX).toBeGreaterThan(bounds.minX)
    expect(bounds.maxY).toBeGreaterThan(bounds.minY)
  })

  it('produces a transparent background (corners are clear)', () => {
    const { frame } = renderText('A')
    // top-left corner alpha should be 0 (transparent)
    const a = frame.rgba[3]!
    expect(a).toBe(0)
  })

  it('renders the fill color into visible pixels', () => {
    const { frame } = renderText('A')
    // scan for a fully-opaque red-dominant pixel
    let foundRed = false
    for (let i = 0; i < frame.rgba.length; i += 4) {
      const r = frame.rgba[i]!
      const g = frame.rgba[i + 1]!
      const b = frame.rgba[i + 2]!
      const al = frame.rgba[i + 3]!
      if (al > 200 && r > 180 && g < 80 && b < 80) {
        foundRed = true
        break
      }
    }
    expect(foundRed).toBe(true)
  })

  it('empty text yields a fully transparent frame', () => {
    const { frame } = renderText('')
    const bounds = getAlphaBounds(frame.rgba, frame.width, frame.height, 10)
    expect(bounds.maxX).toBeLessThan(bounds.minX) // empty bounds
  })

  it('fits a larger font for short text than for long text', () => {
    const short = renderText('A').layout.fontSize
    const long = renderText('ABCDEFGHIJKLMNOP').layout.fontSize
    expect(short).toBeGreaterThan(long)
  })
})
