import { describe, it, expect } from 'vitest'
import { EXPORT_PRESETS, getExportPreset } from './exportPresets'
import { readabilityPenalty } from './readability'
import { createDefaultProject } from '../project/defaults'

describe('export presets', () => {
  it('apng-rich enables animation at 256px', () => {
    const p = createDefaultProject()
    getExportPreset('apng-rich')!.apply(p)
    expect(p.export.format).toBe('apng')
    expect(p.export.finalWidth).toBe(256)
    expect(p.animation.enabled).toBe(true)
  })

  it('static-128 disables animation and uses PNG', () => {
    const p = createDefaultProject()
    getExportPreset('static-128')!.apply(p)
    expect(p.export.format).toBe('png')
    expect(p.animation.enabled).toBe(false)
  })

  it('every preset has a unique id and label', () => {
    const ids = new Set(EXPORT_PRESETS.map((p) => p.id))
    expect(ids.size).toBe(EXPORT_PRESETS.length)
  })
})

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
