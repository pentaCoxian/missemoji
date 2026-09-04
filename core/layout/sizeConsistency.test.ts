import { describe, it, expect, beforeAll } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { setCanvasFactory, createSurface } from '../render/renderContext'
import { solveLayout } from './solve'
import { createDefaultProject } from '../project/defaults'
import { refPxToFraction } from '../project/units'
import type { EmojiProject } from '../project/schema'

/**
 * The point size a project resolves to must be the SAME FRACTION of the canvas
 * at every export size — a 256×256 emoji is a 2× enlargement of the 128×128
 * one, not a differently-proportioned drawing. This holds because every style
 * length is stored as a fraction of canvas size (core/project/units.ts).
 */
beforeAll(() => setCanvasFactory((w, h) => createCanvas(w, h) as unknown as OffscreenCanvas))

function solveAt(base: EmojiProject, size: number) {
  const p: EmojiProject = JSON.parse(JSON.stringify(base))
  p.export.finalWidth = size
  p.export.finalHeight = size
  p.size = { width: size, height: size }
  return solveLayout(createSurface(64, 64).ctx, p)
}

function project(text: string, extra: (p: EmojiProject) => void = () => {}): EmojiProject {
  const p = createDefaultProject()
  p.text = text
  p.font.family = 'sans-serif'
  extra(p)
  return p
}

const SIZES = [64, 128, 256, 512]

describe('point size is proportional across export sizes', () => {
  for (const text of ['A', 'やった！', 'ABCDEF', 'こんにちは Misskey']) {
    it(`"${text}" keeps the same fontSize / canvas ratio`, () => {
      const base = project(text)
      const ratios = SIZES.map((s) => solveAt(base, s).fontSize / s)
      for (const r of ratios) expect(r).toBeCloseTo(ratios[0]!, 6)
    })
  }

  it('holds with a thick outline and a big glow (the effects that shrink text)', () => {
    const base = project('やった！', (p) => {
      p.style.strokes = [{ width: refPxToFraction(12), color: '#fff' }]
      p.style.glows = [{ color: '#ffe27a', radius: refPxToFraction(16), intensity: 1 }]
      p.layout.padding = refPxToFraction(8)
    })
    const ratios = SIZES.map((s) => solveAt(base, s).fontSize / s)
    for (const r of ratios) expect(r).toBeCloseTo(ratios[0]!, 6)
  })

  it('holds with letter spacing and an animation reserve', () => {
    const base = project('ABC', (p) => {
      p.font.letterSpacing = refPxToFraction(4)
      p.animation.enabled = true
      p.animation.preset = 'bounce'
    })
    const ratios = SIZES.map((s) => solveAt(base, s).fontSize / s)
    for (const r of ratios) expect(r).toBeCloseTo(ratios[0]!, 6)
  })

  it('picks the same line breaks and stretch at every size', () => {
    const base = project('こんにちは Misskey')
    const shapes = SIZES.map((s) => {
      const l = solveAt(base, s)
      return {
        lines: l.lines.map((x) => x.clusters.join('')).join('|'),
        sx: Math.round(l.stretchX * 1000),
        sy: Math.round(l.stretchY * 1000),
      }
    })
    for (const shape of shapes) expect(shape).toEqual(shapes[0])
  })
})
