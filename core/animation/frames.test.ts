import { describe, it, expect } from 'vitest'
import { buildFramePlan, MAX_FRAMES } from './frames'
import { createDefaultProject } from '../project/defaults'

function anim(fps: number, durationMs: number, enabled = true) {
  return { ...createDefaultProject().animation, enabled, fps, durationMs }
}

describe('buildFramePlan', () => {
  it('returns a single zero-delay frame when disabled', () => {
    expect(buildFramePlan(anim(12, 1000, false))).toEqual([
      { frameIndex: 0, progress: 0, delayMs: 0 },
    ])
  })

  it('delays sum exactly to the duration for every fps × duration combo', () => {
    for (let fps = 6; fps <= 24; fps++) {
      for (let d = 400; d <= 2000; d += 100) {
        const plan = buildFramePlan(anim(fps, d))
        const sum = plan.reduce((s, f) => s + f.delayMs, 0)
        expect(sum, `fps=${fps} d=${d}`).toBe(d)
        for (const f of plan) expect(f.delayMs).toBeGreaterThan(0)
      }
    }
  })

  it('progress is monotone in [0, 1) with frameIndex = position', () => {
    const plan = buildFramePlan(anim(12, 1400))
    plan.forEach((f, i) => {
      expect(f.frameIndex).toBe(i)
      expect(f.progress).toBeCloseTo(i / plan.length, 10)
    })
    expect(plan[plan.length - 1]!.progress).toBeLessThan(1)
  })

  it('clamps the frame count', () => {
    expect(buildFramePlan(anim(60, 10000)).length).toBe(MAX_FRAMES)
    expect(buildFramePlan(anim(1, 100)).length).toBe(1)
  })
})
