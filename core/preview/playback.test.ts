import { describe, it, expect, vi } from 'vitest'
import { advancePlayhead, createGenerationGate, installFrameSet, type FrameSet } from './playback'

describe('advancePlayhead', () => {
  const delays = [100, 100, 100]

  it('steps several frames on a slow tick and carries the remainder', () => {
    const r = advancePlayhead({ index: 0, accumMs: 0 }, 250, delays, true)
    expect(r).toEqual({ index: 2, accumMs: 50, ended: false })
  })

  it('wraps when looping', () => {
    const r = advancePlayhead({ index: 2, accumMs: 90 }, 20, delays, true)
    expect(r).toEqual({ index: 0, accumMs: 10, ended: false })
  })

  it('parks on the last frame and reports ended when not looping', () => {
    const r = advancePlayhead({ index: 2, accumMs: 90 }, 20, delays, false)
    expect(r).toEqual({ index: 2, accumMs: 0, ended: true })
  })

  it('does nothing before a frame delay elapses', () => {
    expect(advancePlayhead({ index: 1, accumMs: 30 }, 40, delays, true)).toEqual({
      index: 1,
      accumMs: 70,
      ended: false,
    })
  })

  it('clamps an out-of-range index and absurd elapsed times', () => {
    const r = advancePlayhead({ index: 99, accumMs: 0 }, 1e9, delays, true)
    expect(r.index).toBeLessThan(delays.length)
    expect(r.ended).toBe(false)
  })

  it('a single frame is static', () => {
    expect(advancePlayhead({ index: 0, accumMs: 0 }, 500, [100], true).ended).toBe(false)
    expect(advancePlayhead({ index: 0, accumMs: 0 }, 500, [100], false).ended).toBe(true)
  })
})

describe('createGenerationGate', () => {
  it('only the latest generation is current', () => {
    const gate = createGenerationGate()
    const a = gate.next()
    const b = gate.next()
    expect(gate.isCurrent(a)).toBe(false)
    expect(gate.isCurrent(b)).toBe(true)
    expect(gate.current()).toBe(b)
  })
})

describe('installFrameSet', () => {
  const bmp = () => ({ close: vi.fn() })
  const set = (
    generation: number,
    bitmaps: ReturnType<typeof bmp>[],
  ): FrameSet<ReturnType<typeof bmp>> => ({
    generation,
    bitmaps,
    delays: bitmaps.map(() => 100),
    width: 1,
    height: 1,
    stats: [],
  })

  it('closes the previous bitmaps that are not reused', () => {
    const shared = bmp()
    const old = bmp()
    const prev = set(1, [old, shared])
    const next = set(2, [shared, bmp()])
    expect(installFrameSet(prev, next)).toBe(next)
    expect(old.close).toHaveBeenCalledTimes(1)
    expect(shared.close).not.toHaveBeenCalled()
  })

  it('accepts a null previous set', () => {
    const next = set(1, [bmp()])
    expect(installFrameSet(null, next)).toBe(next)
  })
})
