import { describe, it, expect } from 'vitest'
import { migrateProject, ProjectMigrationError } from './migrate'
import { createDefaultProject } from './defaults'
import { PROJECT_VERSION } from './schema'
import { refPxToFraction } from './units'

describe('migrateProject', () => {
  it('round-trips the default project unchanged', () => {
    const d = createDefaultProject()
    expect(migrateProject(JSON.parse(JSON.stringify(d)))).toEqual(d)
  })

  it('fills an empty object with defaults', () => {
    expect(migrateProject({})).toEqual(createDefaultProject())
  })

  it('upgrades a v1 project: drops autoLineBreak, adds timing fields, stamps the version', () => {
    const v1 = JSON.parse(JSON.stringify(createDefaultProject())) as Record<string, unknown>
    v1.version = 1
    ;(v1.layout as Record<string, unknown>).autoLineBreak = true
    const a = v1.animation as Record<string, unknown>
    delete a.direction
    delete a.hold
    delete a.phase
    const out = migrateProject(v1)
    expect(out.version).toBe(PROJECT_VERSION)
    expect('autoLineBreak' in out.layout).toBe(false)
    expect(out.animation.direction).toBe('forward')
    expect(out.animation.hold).toBe(0)
    expect(out.animation.phase).toBe(0)
  })

  it('maps removed export formats to apng and rejects bad enums', () => {
    const p = JSON.parse(JSON.stringify(createDefaultProject()))
    p.export.format = 'webp'
    p.layout.mode = 'bogus'
    p.animation.direction = 'sideways'
    const out = migrateProject(p)
    expect(out.export.format).toBe('apng')
    expect(out.layout.mode).toBe('fit')
    expect(out.animation.direction).toBe('forward')
  })

  it('sanitizes numbers and effect arrays', () => {
    const p = JSON.parse(JSON.stringify(createDefaultProject()))
    p.style.strokes = [{ width: 'NaN', color: '#000' }, 'junk', { width: 0.1 }]
    p.style.glows = [{ radius: -5, intensity: 99 }]
    p.animation.fps = Number.NaN
    p.animation.hold = 3
    p.animation.params = { amount: 0.2, bad: {}, flag: true }
    const out = migrateProject(p)
    expect(out.style.strokes).toEqual([
      { width: refPxToFraction(6), color: '#000' },
      { width: 0.1, color: '#ffffff' },
    ])
    expect(out.style.glows[0]).toEqual({ color: '#ffe27a', radius: 0, intensity: 2 })
    expect(out.animation.fps).toBe(12)
    expect(out.animation.hold).toBe(0.5)
    expect(out.animation.params).toEqual({ amount: 0.2, flag: true })
  })

  it('converts v2 pixel geometry into fractions of the project canvas', () => {
    const v2 = JSON.parse(JSON.stringify(createDefaultProject())) as Record<string, unknown>
    v2.version = 2
    // a v2 project stored pixels on its own canvas
    Object.assign(v2.layout as object, { padding: 4 })
    Object.assign(v2.font as object, { letterSpacing: 2 })
    ;(v2.style as Record<string, unknown>).strokes = [{ width: 6, color: '#fff' }]
    ;(v2.style as Record<string, unknown>).glows = [{ color: '#ffe27a', radius: 8, intensity: 0.8 }]
    ;(v2.export as Record<string, unknown>).finalWidth = 128
    ;(v2.export as Record<string, unknown>).finalHeight = 128

    const out = migrateProject(v2)
    expect(out.version).toBe(PROJECT_VERSION)
    expect(out.layout.padding).toBeCloseTo(4 / 128, 10)
    expect(out.font.letterSpacing).toBeCloseTo(2 / 128, 10)
    expect(out.style.strokes[0]!.width).toBeCloseTo(6 / 128, 10)
    expect(out.style.glows[0]!.radius).toBeCloseTo(8 / 128, 10)
  })

  it('divides a v2 project by ITS canvas, so a 256px project keeps its look', () => {
    const v2 = JSON.parse(JSON.stringify(createDefaultProject())) as Record<string, unknown>
    v2.version = 2
    ;(v2.style as Record<string, unknown>).strokes = [{ width: 12, color: '#fff' }]
    ;(v2.export as Record<string, unknown>).finalWidth = 256
    ;(v2.export as Record<string, unknown>).finalHeight = 256
    // 12px on a 256px canvas is the same relative weight as 6px on 128px
    expect(migrateProject(v2).style.strokes[0]!.width).toBeCloseTo(6 / 128, 10)
  })

  it('leaves v3 fractions alone', () => {
    const v3 = createDefaultProject()
    v3.export.finalWidth = 256
    v3.export.finalHeight = 256
    const out = migrateProject(JSON.parse(JSON.stringify(v3)))
    expect(out.style.strokes[0]!.width).toBeCloseTo(v3.style.strokes[0]!.width, 10)
    expect(out.layout.padding).toBeCloseTo(v3.layout.padding, 10)
  })

  it('throws for non-object input', () => {
    expect(() => migrateProject(null)).toThrow(ProjectMigrationError)
    expect(() => migrateProject('{}')).toThrow(ProjectMigrationError)
    expect(() => migrateProject([])).toThrow(ProjectMigrationError)
  })
})
