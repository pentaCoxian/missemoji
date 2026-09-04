import { describe, it, expect } from 'vitest'
import { readabilityPenalty } from './readability'
import { createDefaultProject } from '../project/defaults'

describe('readabilityPenalty', () => {
  it('penalizes very small effective text', () => {
    const p = createDefaultProject()
    p.export.finalWidth = 128
    // tiny font -> small at 24px
    const penalty = readabilityPenalty(p, { fontSize: 8, lineCount: 1 })
    expect(penalty).toBeGreaterThan(0)
  })

  it('penalizes thick outlines relative to glyph size', () => {
    const p = createDefaultProject()
    p.style.strokes = [{ width: 30, color: '#fff' }]
    const penalty = readabilityPenalty(p, { fontSize: 60, lineCount: 1 })
    expect(penalty).toBeGreaterThan(0)
  })

  it('returns 0 for comfortable large legible text', () => {
    const p = createDefaultProject()
    p.style.strokes = []
    const penalty = readabilityPenalty(p, { fontSize: 90, lineCount: 1 })
    expect(penalty).toBe(0)
  })
})
