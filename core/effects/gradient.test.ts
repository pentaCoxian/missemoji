import { describe, it, expect } from 'vitest'
import { featherStops } from './gradient'
import type { GradientStop } from '../project/schema'

describe('featherStops', () => {
  const two: GradientStop[] = [
    { position: 0, color: '#ff0000' },
    { position: 1, color: '#0000ff' },
  ]

  it('inserts intermediate stops between two colors', () => {
    const out = featherStops(two, 6)
    // 2 endpoints + 6 interpolated = 8
    expect(out.length).toBe(8)
    expect(out[0]!.position).toBe(0)
    expect(out[out.length - 1]!.position).toBe(1)
  })

  it('keeps stops monotonically increasing in position', () => {
    const out = featherStops(two, 6)
    for (let i = 1; i < out.length; i++) {
      expect(out[i]!.position).toBeGreaterThanOrEqual(out[i - 1]!.position)
    }
  })

  it('interpolates the middle toward a blend of endpoints', () => {
    const out = featherStops(two, 1)
    // single middle stop ~ purple (mix of red+blue) via smoothstep at t=0.5
    const mid = out[1]!.color
    expect(mid).toMatch(/^rgba\(/)
    // both red and blue channels should be > 0 in the blend
    const m = /rgba\((\d+),(\d+),(\d+)/.exec(mid)!
    expect(Number(m[1])).toBeGreaterThan(0) // red
    expect(Number(m[3])).toBeGreaterThan(0) // blue
  })

  it('returns the original when fewer than 2 stops', () => {
    const one: GradientStop[] = [{ position: 0, color: '#fff' }]
    expect(featherStops(one, 6)).toEqual(one)
  })
})
