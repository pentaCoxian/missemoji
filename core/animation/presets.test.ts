import { describe, it, expect } from 'vitest'
import { PRESETS } from './presets'
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
    layer.rotate,
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

describe('presets loop seamlessly', () => {
  for (const preset of PRESETS) {
    it(`${preset.id}: sample(0) equals sample(1)`, () => {
      const a = preset.sample(0, preset.defaultParams)
      const b = preset.sample(1, preset.defaultParams)
      const fa = flatten(a.layer)
      const fb = flatten(b.layer)
      for (let i = 0; i < fa.length; i++) {
        expect(fa[i]).toBeCloseTo(fb[i]!, 5)
      }
      expect(a.paint.glowIntensity).toBeCloseTo(b.paint.glowIntensity, 5)
    })

    it(`${preset.id}: per-char wave loops if present`, () => {
      const a = preset.sample(0, preset.defaultParams)
      const b = preset.sample(1, preset.defaultParams)
      if (a.perChar && b.perChar) {
        const ya = a.perChar(2, 5).translate?.y ?? 0
        const yb = b.perChar(2, 5).translate?.y ?? 0
        expect(ya).toBeCloseTo(yb, 5)
      }
    })

    it(`${preset.id}: motion is smooth across adjacent frames (no big jumps)`, () => {
      const N = 24
      let prev = flatten(preset.sample(0, preset.defaultParams).layer)
      let maxJump = 0
      for (let i = 1; i <= N; i++) {
        const cur = flatten(preset.sample(i / N, preset.defaultParams).layer)
        for (let k = 0; k < cur.length; k++) {
          maxJump = Math.max(maxJump, Math.abs(cur[k]! - prev[k]!))
        }
        prev = cur
      }
      // No single-step jump should be large for gentle defaults.
      expect(maxJump).toBeLessThan(0.2)
    })
  }
})
