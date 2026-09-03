import { describe, it, expect } from 'vitest'
import { PRESETS, presetDefaults } from './presets'
import { smoothLoopEnvelope, smoothLoopOsc, breathe } from './easing'
import type { LayerTransform } from './model'

/**
 * Verify every preset loops SEAMLESSLY: the frame state at progress 0 must equal
 * the state at progress 1 (no jump at the wrap), and the motion should be smooth
 * (no large jump between adjacent sampled frames). This is the user's request:
 * smoother, more loop-friendly curves.
 */

function flatten(layer: LayerTransform): number[] {
  return [
    layer.translate.x,
    layer.translate.y,
    layer.scale.x,
    layer.scale.y,
    // rotation compared on the circle: a whole turn is the same pose
    Math.cos(layer.rotate),
    Math.sin(layer.rotate),
    layer.opacity,
    layer.blur,
  ]
}

describe('animation easing (loop-friendly)', () => {
  it('smoothLoopEnvelope returns 0 at both ends and 1 in the middle', () => {
    expect(smoothLoopEnvelope(0)).toBeCloseTo(0, 6)
    expect(smoothLoopEnvelope(1)).toBeCloseTo(0, 6)
    expect(smoothLoopEnvelope(0.5)).toBeCloseTo(1, 6)
  })

  it('smoothLoopEnvelope has ~zero velocity at the wrap (C1 loop)', () => {
    const eps = 1e-4
    const slopeStart = (smoothLoopEnvelope(eps) - smoothLoopEnvelope(0)) / eps
    const slopeEnd = (smoothLoopEnvelope(1) - smoothLoopEnvelope(1 - eps)) / eps
    expect(Math.abs(slopeStart)).toBeLessThan(0.01)
    expect(Math.abs(slopeEnd)).toBeLessThan(0.01)
  })

  it('smoothLoopOsc and breathe match endpoints', () => {
    expect(smoothLoopOsc(0)).toBeCloseTo(smoothLoopOsc(1), 6)
    expect(breathe(0)).toBeCloseTo(breathe(1), 6)
  })
})

describe('preset metadata', () => {
  it('ids are unique', () => {
    const ids = PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  for (const preset of PRESETS) {
    it(`${preset.id}: every param default lies within its range`, () => {
      for (const def of preset.params) {
        expect(def.step).toBeGreaterThan(0)
        expect(def.default).toBeGreaterThanOrEqual(def.min)
        expect(def.default).toBeLessThanOrEqual(def.max)
        expect(presetDefaults(preset)[def.key]).toBe(def.default)
      }
    })
  }
})

describe('presets loop seamlessly', () => {
  for (const preset of PRESETS) {
    it(`${preset.id}: sample(0) equals sample(1)`, () => {
      const a = preset.sample(0, presetDefaults(preset))
      const b = preset.sample(1, presetDefaults(preset))
      const fa = flatten(a.layer)
      const fb = flatten(b.layer)
      for (let i = 0; i < fa.length; i++) {
        expect(fa[i]).toBeCloseTo(fb[i]!, 5)
      }
      expect(a.paint.glowIntensity).toBeCloseTo(b.paint.glowIntensity, 5)
      expect(a.paint.strokeWidthMul).toBeCloseTo(b.paint.strokeWidthMul, 5)
      expect(a.paint.gradientOffset).toBeCloseTo(b.paint.gradientOffset, 5)
      const hue = (deg: number) => ((deg % 360) + 360) % 360
      expect(hue(a.paint.hueShift)).toBeCloseTo(hue(b.paint.hueShift), 5)
      expect(a.tile?.phase ?? 0).toBeCloseTo(b.tile?.phase ?? 0, 5)
    })

    it(`${preset.id}: per-char wave loops if present`, () => {
      const a = preset.sample(0, presetDefaults(preset))
      const b = preset.sample(1, presetDefaults(preset))
      if (a.perChar && b.perChar) {
        const info = { index: 2, count: 5, line: 0, lineCount: 1, indexInLine: 2, lineLength: 5 }
        const ya = a.perChar(info).translate?.y ?? 0
        const yb = b.perChar(info).translate?.y ?? 0
        expect(ya).toBeCloseTo(yb, 5)
      }
    })

    it(`${preset.id}: motion is smooth across adjacent frames (no big jumps)`, () => {
      const N = 24
      const params = presetDefaults(preset)
      let prev = flatten(preset.sample(0, params).layer)
      let maxJump = 0
      for (let i = 1; i <= N; i++) {
        const cur = flatten(preset.sample(i / N, params).layer)
        for (let k = 0; k < cur.length; k++) {
          maxJump = Math.max(maxJump, Math.abs(cur[k]! - prev[k]!))
        }
        prev = cur
      }
      // No single-step jump should be large for gentle defaults. Deliberately
      // fast presets get a wider allowance (still far from a visible pop).
      const allowance: Record<string, number> = { spin: 0.3, blink: 0.6 }
      expect(maxJump).toBeLessThan(allowance[preset.id] ?? 0.2)
    })
  }
})
