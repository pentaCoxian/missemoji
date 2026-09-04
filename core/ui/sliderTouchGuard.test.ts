import { describe, it, expect } from 'vitest'
import { createSliderTouchGuard } from './sliderTouchGuard'

/**
 * The guard decides whether a range input's `input` event came from a real
 * drag or from a touch that was actually a scroll. These tests drive it with
 * synthetic touch data; the browser behaviour it compensates for (a range
 * input jumping its thumb to the touch point) is verified separately in the
 * headless-Chrome pass.
 */

/** A touch list good enough for the guard, which reads identifier/clientX/Y. */
function touches(...points: { id: number; x: number; y: number }[]) {
  return points.map((p) => ({
    identifier: p.id,
    clientX: p.x,
    clientY: p.y,
  })) as unknown as Touch[]
}

function touchEvent(list: Touch[], changed = list) {
  return { touches: list, changedTouches: changed } as unknown as TouchEvent
}

/** A stand-in for the range input; the guard only reads and writes `.value`. */
function input(value: number) {
  return { value: String(value) } as HTMLInputElement
}

function guard(value = 50) {
  let current = value
  const g = createSliderTouchGuard(() => current)
  return { ...g, set: (v: number) => (current = v) }
}

describe('createSliderTouchGuard', () => {
  it('ignores input from a touch that has not moved (a mistap)', () => {
    const g = guard(50)
    g.handlers.touchstart(touchEvent(touches({ id: 1, x: 100, y: 200 })))
    const el = input(80) // the browser already jumped the thumb
    expect(g.shouldIgnoreInput(el)).toBe(true)
    expect(el.value).toBe('50') // and the guard put it back
  })

  it('ignores input while the finger is travelling vertically (a scroll)', () => {
    const g = guard(50)
    g.handlers.touchstart(touchEvent(touches({ id: 1, x: 100, y: 200 })))
    g.handlers.touchmove(touchEvent(touches({ id: 1, x: 103, y: 260 })))
    expect(g.shouldIgnoreInput(input(90))).toBe(true)
  })

  it('accepts input once the finger moves clearly horizontally', () => {
    const g = guard(50)
    g.handlers.touchstart(touchEvent(touches({ id: 1, x: 100, y: 200 })))
    g.handlers.touchmove(touchEvent(touches({ id: 1, x: 140, y: 205 })))
    const el = input(70)
    expect(g.shouldIgnoreInput(el)).toBe(false)
    expect(el.value).toBe('70') // untouched, so the caller emits it
  })

  it('keeps accepting input for the rest of a drag, including vertical wander', () => {
    const g = guard(50)
    g.handlers.touchstart(touchEvent(touches({ id: 1, x: 100, y: 200 })))
    g.handlers.touchmove(touchEvent(touches({ id: 1, x: 140, y: 202 })))
    // a finger drifting off-axis mid-drag must not re-arm the guard
    g.handlers.touchmove(touchEvent(touches({ id: 1, x: 150, y: 320 })))
    expect(g.shouldIgnoreInput(input(95))).toBe(false)
  })

  it('does not commit to a drag on movement below the slop threshold', () => {
    const g = guard(50)
    g.handlers.touchstart(touchEvent(touches({ id: 1, x: 100, y: 200 })))
    g.handlers.touchmove(touchEvent(touches({ id: 1, x: 105, y: 200 })))
    expect(g.shouldIgnoreInput(input(60))).toBe(true)
  })

  it('follows the original finger when a second one joins', () => {
    const g = guard(50)
    g.handlers.touchstart(touchEvent(touches({ id: 1, x: 100, y: 200 })))
    // a second finger moving horizontally must not unlock the first
    g.handlers.touchmove(touchEvent(touches({ id: 1, x: 100, y: 260 }, { id: 2, x: 300, y: 200 })))
    expect(g.shouldIgnoreInput(input(90))).toBe(true)
  })

  it('lets mouse and keyboard input through when no touch is active', () => {
    const g = guard(50)
    expect(g.shouldIgnoreInput(input(70))).toBe(false)
  })

  it('re-arms for the next gesture after the finger lifts', () => {
    const g = guard(50)
    g.handlers.touchstart(touchEvent(touches({ id: 1, x: 100, y: 200 })))
    g.handlers.touchmove(touchEvent(touches({ id: 1, x: 140, y: 200 })))
    expect(g.shouldIgnoreInput(input(70))).toBe(false)
    g.handlers.touchend()
    // a fresh tap is guarded again, from the new value
    g.set(70)
    g.handlers.touchstart(touchEvent(touches({ id: 2, x: 100, y: 200 })))
    const el = input(20)
    expect(g.shouldIgnoreInput(el)).toBe(true)
    expect(el.value).toBe('70')
  })

  it('releases the guard when a touch is cancelled', () => {
    const g = guard(50)
    g.handlers.touchstart(touchEvent(touches({ id: 1, x: 100, y: 200 })))
    g.handlers.touchcancel()
    expect(g.shouldIgnoreInput(input(70))).toBe(false)
  })
})
