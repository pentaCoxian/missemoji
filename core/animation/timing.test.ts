import { describe, it, expect } from 'vitest'
import { remapProgress } from './timing'
import { PRESETS, presetDefaults } from './presets'
import type { AnimDirection } from '../project/schema'
import type { FrameState } from './model'

const fwd = { direction: 'forward' as const, hold: 0, phase: 0 }

function flat(s: FrameState): number[] {
  return [
    s.layer.translate.x,
    s.layer.translate.y,
    s.layer.scale.x,
    s.layer.scale.y,
    Math.cos(s.layer.rotate),
    Math.sin(s.layer.rotate),
    s.layer.opacity,
    s.layer.blur,
    s.paint.glowIntensity,
    s.paint.strokeWidthMul,
    s.paint.gradientOffset,
    ((s.paint.hueShift % 360) + 360) % 360,
    s.paint.minSaturation,
  ]
}

describe('remapProgress', () => {
  it('forward with no hold/phase is the identity', () => {
    for (const t of [0, 0.1, 0.5, 0.99]) expect(remapProgress(t, fwd)).toBeCloseTo(t, 12)
  })

  it('phase rotates the loop start and wraps', () => {
    expect(remapProgress(0, { ...fwd, phase: 0.25 })).toBeCloseTo(0.25, 12)
    expect(remapProgress(0.9, { ...fwd, phase: 0.25 })).toBeCloseTo(0.15, 12)
  })

  it('hold pins the first part of the loop at rest and stretches the rest to 1', () => {
    const h = { ...fwd, hold: 0.2 }
    expect(remapProgress(0, h)).toBe(0)
    expect(remapProgress(0.1, h)).toBe(0)
    expect(remapProgress(0.19, h)).toBe(0)
    expect(remapProgress(0.2, h)).toBeCloseTo(0, 12)
    expect(remapProgress(0.6, h)).toBeCloseTo(0.5, 12)
    expect(remapProgress(1 - 1e-9, h)).toBeCloseTo(1, 6)
    // t=1 is the same instant as t=0 in a loop: it wraps to rest
    expect(remapProgress(1, h)).toBe(0)
  })

  it('reverse and pingpong keep both ends at rest', () => {
    expect(remapProgress(0, { ...fwd, direction: 'reverse' })).toBe(1)
    expect(remapProgress(0.25, { ...fwd, direction: 'reverse' })).toBeCloseTo(0.75, 12)
    expect(remapProgress(0, { ...fwd, direction: 'pingpong' })).toBe(0)
    expect(remapProgress(0.25, { ...fwd, direction: 'pingpong' })).toBeCloseTo(0.5, 12)
    expect(remapProgress(0.5, { ...fwd, direction: 'pingpong' })).toBeCloseTo(1, 12)
    expect(remapProgress(0.75, { ...fwd, direction: 'pingpong' })).toBeCloseTo(0.5, 12)
    expect(remapProgress(1, { ...fwd, direction: 'pingpong' })).toBeCloseTo(0, 12)
  })

  it('every preset × direction (with hold + phase) still loops seamlessly', () => {
    const dirs: AnimDirection[] = ['forward', 'reverse', 'pingpong']
    for (const preset of PRESETS) {
      const params = presetDefaults(preset)
      for (const direction of dirs) {
        const timing = { direction, hold: 0.2, phase: 0.3 }
        const a = flat(preset.sample(remapProgress(0, timing), params))
        const b = flat(preset.sample(remapProgress(1, timing), params))
        a.forEach((v, i) => expect(v, `${preset.id}/${direction}[${i}]`).toBeCloseTo(b[i]!, 6))
      }
    }
  })
})
