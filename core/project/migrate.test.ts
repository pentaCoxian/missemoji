import { describe, it, expect } from 'vitest'
import { migrateProject, ProjectMigrationError } from './migrate'
import { createDefaultProject } from './defaults'
import { PROJECT_VERSION } from './schema'

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
    p.style.strokes = [{ width: 'NaN', color: '#000' }, 'junk', { width: 12 }]
    p.style.glows = [{ radius: -5, intensity: 99 }]
    p.animation.fps = Number.NaN
    p.animation.hold = 3
    p.animation.params = { amount: 0.2, bad: {}, flag: true }
    const out = migrateProject(p)
    expect(out.style.strokes).toEqual([
      { width: 6, color: '#000' },
      { width: 12, color: '#ffffff' },
    ])
    expect(out.style.glows[0]).toEqual({ color: '#ffe27a', radius: 0, intensity: 2 })
    expect(out.animation.fps).toBe(12)
    expect(out.animation.hold).toBe(0.5)
    expect(out.animation.params).toEqual({ amount: 0.2, flag: true })
  })

  it('throws for non-object input', () => {
    expect(() => migrateProject(null)).toThrow(ProjectMigrationError)
    expect(() => migrateProject('{}')).toThrow(ProjectMigrationError)
    expect(() => migrateProject([])).toThrow(ProjectMigrationError)
  })
})
