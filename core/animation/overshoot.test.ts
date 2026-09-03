import { describe, it, expect } from 'vitest'
import { computeOvershoot } from './overshoot'
import { createDefaultProject } from '../project/defaults'
import { computeSafeMargins } from '../layout/safebox'

function project(preset: string, params: Record<string, number> = {}, enabled = true) {
  const p = createDefaultProject()
  p.animation.enabled = enabled
  p.animation.preset = preset
  p.animation.params = params
  return p
}

describe('computeOvershoot', () => {
  it('is 0 when animation is disabled or the preset is unknown', () => {
    expect(computeOvershoot(project('bounce', {}, false))).toBe(0)
    expect(computeOvershoot(project('nope'))).toBe(0)
  })

  it('pulse reserves roughly amount × content half-size', () => {
    const p = project('pulse', { amount: 0.06 })
    const A = p.export.finalWidth / 2 - computeSafeMargins(p, 0).total
    const m = computeOvershoot(p)
    // fixed point of m = 0.06 (A - m)
    expect(m).toBeCloseTo((0.06 * A) / 1.06, 0)
  })

  it('bounce reserves its travel (minus the squash)', () => {
    const m = computeOvershoot(project('bounce', { height: 0.12 }))
    expect(m).toBeGreaterThan(10)
    expect(m).toBeLessThan(16)
  })

  it('grows monotonically with the user params', () => {
    const small = computeOvershoot(project('bounce', { height: 0.05 }))
    const mid = computeOvershoot(project('bounce', { height: 0.12 }))
    const big = computeOvershoot(project('bounce', { height: 0.3 }))
    expect(small).toBeLessThan(mid)
    expect(mid).toBeLessThan(big)
    const w6 = computeOvershoot(project('wiggle', { degrees: 6 }))
    const w30 = computeOvershoot(project('wiggle', { degrees: 30 }))
    expect(w6).toBeLessThan(w30)
  })

  it('models rotation from the box diagonal, not a flat fraction', () => {
    const p = project('wiggle', { degrees: 30 })
    const A = p.export.finalWidth / 2 - computeSafeMargins(p, 0).total
    // a square box rotated 30° reaches A(cos30 + sin30) − A ≈ 0.366A before
    // the fixed point shrinks it: m = 0.366 (A − m) → 0.268A
    expect(computeOvershoot(p)).toBeCloseTo((0.366 * A) / 1.366, 0)
  })

  it('folds per-character motion in (wave reserves its amplitude)', () => {
    const m = computeOvershoot(project('wave', { amount: 0.1 }))
    expect(m).toBeGreaterThan(8)
  })
})
