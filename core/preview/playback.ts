import type { FrameStats } from '../types'

/**
 * Pure helpers behind the preview player (app/composables/usePreviewPipeline).
 * Kept framework-free so the timing logic is unit-testable.
 */

export interface PlayheadState {
  index: number
  /** time carried into the current frame, ms */
  accumMs: number
}

export interface PlayheadStep extends PlayheadState {
  /** true when a non-looping run reached its last frame */
  ended: boolean
}

/** Longest elapsed interval honoured per tick (a backgrounded tab resumes sanely). */
const MAX_ELAPSED_MS = 1000

/**
 * Advance the playhead by `elapsedMs` over per-frame `delays`. Steps as many
 * frames as the elapsed time covers (a slow tab does not slow the animation
 * down), wraps when looping, and otherwise parks on the last frame.
 */
export function advancePlayhead(
  state: PlayheadState,
  elapsedMs: number,
  delays: number[],
  loop: boolean,
): PlayheadStep {
  if (delays.length <= 1) return { index: 0, accumMs: 0, ended: !loop }
  let index = Math.min(Math.max(0, state.index), delays.length - 1)
  let accumMs = state.accumMs + Math.min(Math.max(0, elapsedMs), MAX_ELAPSED_MS)
  let ended = false
  for (;;) {
    const delay = Math.max(1, delays[index]!)
    if (accumMs < delay) break
    accumMs -= delay
    if (index + 1 < delays.length) {
      index++
    } else if (loop) {
      index = 0
    } else {
      ended = true
      accumMs = 0
      break
    }
  }
  return { index, accumMs, ended }
}

/** Monotonic generation counter to drop results of superseded requests. */
export function createGenerationGate() {
  let current = 0
  return {
    next: () => ++current,
    current: () => current,
    isCurrent: (g: number) => g === current,
  }
}

/** A closable bitmap (ImageBitmap, or a stand-in during tests). */
export interface ClosableBitmap {
  close(): void
}

export interface FrameSet<B extends ClosableBitmap = ImageBitmap> {
  generation: number
  bitmaps: B[]
  delays: number[]
  width: number
  height: number
  stats: FrameStats[]
}

/** Swap in a new frame set, releasing the previous set's bitmaps. */
export function installFrameSet<B extends ClosableBitmap>(
  prev: FrameSet<B> | null,
  next: FrameSet<B>,
): FrameSet<B> {
  if (prev) {
    for (const b of prev.bitmaps) if (!next.bitmaps.includes(b)) b.close()
  }
  return next
}
