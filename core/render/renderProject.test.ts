import { describe, it, expect, beforeAll } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { setCanvasFactory, createSurface } from './renderContext'
import { renderProjectFrame } from './renderProject'
import { solveLayout } from '../layout/solve'
import { getAlphaBounds } from '../layout/pixelBounds'
import { createDefaultProject } from '../project/defaults'
import { sampleFrameState } from '../animation/sampleAnimation'
import { computeOvershoot } from '../animation/overshoot'
import { IDENTITY_PAINT, IDENTITY_TRANSFORM, type FrameState } from '../animation/model'
import type { EmojiProject } from '../project/schema'
import { PRESETS } from '../animation/presets'
import { buildFramePlan } from '../animation/frames'

/**
 * Headless render verification using @napi-rs/canvas. This exercises the FULL
 * pipeline (solve → place → effects → downscale → RGBA) and asserts on actual
 * pixels — the one thing build/typecheck/unit-math cannot confirm.
 */
beforeAll(() => {
  // @napi-rs/canvas's createCanvas returns a node canvas with getContext('2d').
  setCanvasFactory((w, h) => createCanvas(w, h) as unknown as OffscreenCanvas)
})

function baseProject(text: string): EmojiProject {
  const project = createDefaultProject()
  project.text = text
  project.font.family = 'sans-serif' // a font node-canvas definitely has
  project.style.fill = { type: 'solid', color: '#ff0000' }
  project.style.strokes = []
  return project
}

function renderText(text: string) {
  const project = baseProject(text)
  const measure = createSurface(64, 64)
  const layout = solveLayout(measure.ctx, project)
  const frame = renderProjectFrame(project, { layout })
  return { frame, layout }
}

/** Render one animation frame of `preset` at `progress` (defaults params). */
function renderPreset(project: EmojiProject, preset: string, progress: number) {
  project.animation.enabled = true
  project.animation.preset = preset
  const measure = createSurface(64, 64)
  const layout = solveLayout(measure.ctx, project)
  const frame = sampleFrameState(project.animation, progress)
  return renderProjectFrame(project, { layout, frame })
}

function renderWithFrame(project: EmojiProject, frame: FrameState) {
  const measure = createSurface(64, 64)
  const layout = solveLayout(measure.ctx, project)
  return renderProjectFrame(project, { layout, frame })
}

/** Alpha-weighted centroid of a frame, in final px. */
function centroid(rgba: Uint8ClampedArray, w: number, h: number) {
  let sx = 0
  let sy = 0
  let sum = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = rgba[(y * w + x) * 4 + 3]!
      sx += x * a
      sy += y * a
      sum += a
    }
  }
  return { x: sx / sum, y: sy / sum, alphaSum: sum }
}

function maxAlpha(rgba: Uint8ClampedArray) {
  let m = 0
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i]! > m) m = rgba[i]!
  return m
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

describe('background layer', () => {
  it('solid background fills the corners; blob padding leaves them clear', () => {
    const solid = baseProject('A')
    solid.style.background = { type: 'solid', color: '#3366ff' }
    const measure = createSurface(64, 64)
    const solidOut = renderProjectFrame(solid, { layout: solveLayout(measure.ctx, solid) })
    expect(solidOut.rgba[3]).toBe(255)

    const blob = baseProject('A')
    blob.style.background = { type: 'blob', color: '#3366ff', radius: 24, padding: 8 }
    const blobOut = renderProjectFrame(blob, { layout: solveLayout(measure.ctx, blob) })
    expect(blobOut.rgba[3]).toBe(0) // corner, inside the padding
    const mid = ((blobOut.height / 2) * blobOut.width + 10) * 4 // x=10 > padding 8, mid row
    expect(blobOut.rgba[mid + 3]).toBe(255)
  })

  it('blob geometry is in final px regardless of render scale', () => {
    const firstOpaqueX = (scale: number) => {
      const p = baseProject('A')
      p.export.renderScale = scale
      p.style.background = { type: 'blob', color: '#3366ff', radius: 20, padding: 12 }
      const out = renderProjectFrame(p, { layout: solveLayout(createSurface(64, 64).ctx, p) })
      const y = Math.floor(out.height / 2)
      for (let x = 0; x < out.width; x++) if (out.rgba[(y * out.width + x) * 4 + 3]! > 128) return x
      return -1
    }
    expect(firstOpaqueX(2)).toBe(firstOpaqueX(4))
    expect(firstOpaqueX(4)).toBeGreaterThanOrEqual(11)
    expect(firstOpaqueX(4)).toBeLessThanOrEqual(13)
  })
})

describe('motion reserve prevents clipping', () => {
  for (const preset of PRESETS) {
    if (preset.clipsToFrame) continue
    it(`${preset.id}: no frame touches the canvas edge at default params`, () => {
      const project = baseProject('ABC!')
      project.style.strokes = [{ width: 6, color: '#ffffff' }]
      project.animation.enabled = true
      project.animation.preset = preset.id
      project.animation.fps = 12
      project.animation.durationMs = 1000
      const measure = createSurface(64, 64)
      const layout = solveLayout(measure.ctx, project, computeOvershoot(project))
      for (const step of buildFramePlan(project.animation)) {
        const frame = sampleFrameState(project.animation, step.progress)
        const out = renderProjectFrame(project, { layout, frame })
        const { width: w, height: h, rgba } = out
        let edgeAlpha = 0
        for (let x = 0; x < w; x++) {
          edgeAlpha = Math.max(edgeAlpha, rgba[x * 4 + 3]!, rgba[((h - 1) * w + x) * 4 + 3]!)
        }
        for (let y = 0; y < h; y++) {
          edgeAlpha = Math.max(edgeAlpha, rgba[y * w * 4 + 3]!, rgba[(y * w + w - 1) * 4 + 3]!)
        }
        expect(edgeAlpha, `${preset.id} frame ${step.frameIndex}`).toBe(0)
      }
    })
  }
})

describe('animation transforms reach the pixels', () => {
  it('bounce lifts the text at mid-loop (translate is a canvas fraction)', () => {
    const rest = renderPreset(baseProject('A'), 'bounce', 0)
    const top = renderPreset(baseProject('A'), 'bounce', 0.5)
    const c0 = centroid(rest.rgba, rest.width, rest.height)
    const c1 = centroid(top.rgba, top.width, top.height)
    // default height 0.12 × 128px ≈ 15px upward
    expect(c0.y - c1.y).toBeGreaterThan(5)
    expect(Math.abs(c0.x - c1.x)).toBeLessThan(1)
  })

  it('shake moves the text horizontally at a quarter loop', () => {
    const rest = renderPreset(baseProject('A'), 'shake', 0)
    const moved = renderPreset(baseProject('A'), 'shake', 0.25 / 3) // freq 3 → first peak
    const c0 = centroid(rest.rgba, rest.width, rest.height)
    const c1 = centroid(moved.rgba, moved.width, moved.height)
    expect(Math.abs(c1.x - c0.x)).toBeGreaterThan(2)
  })

  it('wave moves letters independently (per-character transforms)', () => {
    // 4 letters at t=0.125: phases 0/.25/.5/.75 → first two go down, last two up
    const still = renderText('AAAA').frame
    const wave = renderPreset(baseProject('AAAA'), 'wave', 0.125)
    const halfTop = (f: typeof still, left: boolean) => {
      const x0 = left ? 0 : f.width / 2
      const x1 = left ? f.width / 2 : f.width
      for (let y = 0; y < f.height; y++) {
        for (let x = x0; x < x1; x++) if (f.rgba[(y * f.width + x) * 4 + 3]! > 10) return y
      }
      return f.height
    }
    expect(Math.abs(halfTop(still, true) - halfTop(still, false))).toBeLessThanOrEqual(1)
    // left half moved DOWN (larger top y), right half moved UP
    expect(halfTop(wave, true) - halfTop(wave, false)).toBeGreaterThan(2)
  })

  it('spin at a quarter loop swaps the content box dimensions', () => {
    const still = renderPreset(baseProject('AB'), 'spin', 0)
    const quarter = renderPreset(baseProject('AB'), 'spin', 0.25)
    const b0 = getAlphaBounds(still.rgba, still.width, still.height, 10)
    const b1 = getAlphaBounds(quarter.rgba, quarter.width, quarter.height, 10)
    const w0 = b0.maxX - b0.minX
    const h0 = b0.maxY - b0.minY
    const w1 = b1.maxX - b1.minX
    const h1 = b1.maxY - b1.minY
    expect(Math.abs(w1 - h0)).toBeLessThanOrEqual(2)
    expect(Math.abs(h1 - w0)).toBeLessThanOrEqual(2)
  })

  it('blink is fully visible at the loop ends and off at mid-loop', () => {
    const on = renderPreset(baseProject('A'), 'blink', 0)
    const off = renderPreset(baseProject('A'), 'blink', 0.5)
    expect(maxAlpha(on.rgba)).toBeGreaterThan(200)
    expect(maxAlpha(off.rgba)).toBeLessThanOrEqual(2)
    const half = baseProject('A')
    half.animation.params = { minOpacity: 0.5 }
    const dim = renderPreset(half, 'blink', 0.5)
    expect(maxAlpha(dim.rgba)).toBeGreaterThanOrEqual(110)
    expect(maxAlpha(dim.rgba)).toBeLessThanOrEqual(145)
  })

  it('gangan shoves the text sideways at its first peak', () => {
    const still = renderText('A').frame
    const shoved = renderPreset(baseProject('A'), 'gangan', 1 / 16) // freq 4 → sin peak
    const c0 = centroid(still.rgba, still.width, still.height)
    const c1 = centroid(shoved.rgba, shoved.width, shoved.height)
    expect(Math.abs(c1.x - c0.x)).toBeGreaterThan(4)
  })

  it('rainbow rotates a red fill to green a third of the way through', () => {
    const out = renderPreset(baseProject('A'), 'rainbow', 1 / 3)
    let dominantGreen = 0
    let opaque = 0
    for (let i = 0; i < out.rgba.length; i += 4) {
      if (out.rgba[i + 3]! < 250) continue
      opaque++
      if (out.rgba[i + 1]! > out.rgba[i]! + 100 && out.rgba[i + 1]! > out.rgba[i + 2]! + 100)
        dominantGreen++
    }
    expect(opaque).toBeGreaterThan(0)
    expect(dominantGreen / opaque).toBeGreaterThan(0.9)
  })

  it('marquee scrolls, wraps seamlessly and runs through the canvas edge', () => {
    const start = renderPreset(baseProject('HELLO'), 'marquee', 0)
    const mid = renderPreset(baseProject('HELLO'), 'marquee', 0.5)
    const wrap = renderPreset(baseProject('HELLO'), 'marquee', 1)
    const b0 = getAlphaBounds(start.rgba, start.width, start.height, 10)
    const b1 = getAlphaBounds(mid.rgba, mid.width, mid.height, 10)
    // single big line wider than the canvas: content reaches an edge
    expect(b0.minX === 0 || b0.maxX >= start.width).toBe(true)
    // something moved between t=0 and t=0.5
    expect(start.rgba).not.toEqual(mid.rgba)
    expect(b0).not.toEqual(b1)
    // t=1 is the same picture as t=0 (seamless wrap)
    expect(wrap.rgba).toEqual(start.rgba)
  })

  it('opacity composites the whole layer once (max alpha ≈ opacity)', () => {
    const project = baseProject('A')
    project.style.strokes = [{ width: 6, color: '#ffffff' }]
    const frame: FrameState = {
      layer: { ...IDENTITY_TRANSFORM, opacity: 0.5 },
      paint: IDENTITY_PAINT,
    }
    const out = renderWithFrame(project, frame)
    const m = maxAlpha(out.rgba)
    expect(m).toBeGreaterThanOrEqual(110)
    expect(m).toBeLessThanOrEqual(145)
  })

  it('glow intensity changes continuously (no integer-pass steps)', () => {
    const sums = [0.7, 0.75, 0.8].map((g) => {
      const project = baseProject('A')
      project.style.glows = [{ color: '#ffe27a', radius: 8, intensity: 1 }]
      const frame: FrameState = {
        layer: IDENTITY_TRANSFORM,
        paint: { ...IDENTITY_PAINT, glowIntensity: g },
      }
      const out = renderWithFrame(project, frame)
      return centroid(out.rgba, out.width, out.height).alphaSum
    })
    const d1 = sums[1]! - sums[0]!
    const d2 = sums[2]! - sums[1]!
    expect(d1).toBeGreaterThan(0)
    expect(d2).toBeGreaterThan(0)
    // consecutive increments should be of the same order (old code jumped 5×)
    expect(Math.max(d1, d2) / Math.min(d1, d2)).toBeLessThan(2.5)
  })
})
