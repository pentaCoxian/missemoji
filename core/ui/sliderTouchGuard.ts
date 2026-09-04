/**
 * Keeps a range input from reacting to touches that were meant as scrolls.
 *
 * A range input claims a touch the moment it lands and jumps its thumb to that
 * spot, so a flick meant to scroll the panel — or a stray tap on the way past —
 * rewrites the value. `touch-action: pan-y` (see main.css) lets the page scroll,
 * but the browser still delivers that first position to the input, so the value
 * moves anyway.
 *
 * The guard swallows input events until the finger has travelled further
 * horizontally than vertically, which is the point where the gesture is
 * unambiguously a slider drag. Mouse, pen and keyboard input are untouched.
 */

/** Horizontal travel, in CSS px, before a touch counts as a drag. */
const SLOP = 8

export function createSliderTouchGuard(currentValue: () => number) {
  let touchId: number | null = null
  let startX = 0
  let startY = 0
  let dragging = false
  /** Value when the finger landed, so a rejected gesture can be undone. */
  let valueAtStart = 0

  function onTouchStart(e: TouchEvent) {
    const t = e.changedTouches[0]
    if (!t) return
    touchId = t.identifier
    startX = t.clientX
    startY = t.clientY
    dragging = false
    valueAtStart = currentValue()
  }

  function onTouchMove(e: TouchEvent) {
    if (touchId === null || dragging) return
    let t: Touch | null = null
    for (const candidate of Array.from(e.touches)) {
      if (candidate.identifier === touchId) t = candidate
    }
    if (!t) return
    const dx = Math.abs(t.clientX - startX)
    const dy = Math.abs(t.clientY - startY)
    // Commit to a drag only once the movement is clearly horizontal.
    if (dx > SLOP && dx > dy) dragging = true
  }

  function onTouchEnd() {
    touchId = null
    dragging = false
  }

  /**
   * Call from the input handler. Returns true when the event came from a touch
   * that has not been accepted as a drag, and rewinds the thumb to where it was
   * — the caller should then ignore the event.
   */
  function shouldIgnoreInput(el: HTMLInputElement) {
    if (touchId === null || dragging) return false
    // Put the thumb back: the browser already moved it to the touch point.
    el.value = String(valueAtStart)
    return true
  }

  return {
    shouldIgnoreInput,
    /** Bind with `v-on="handlers"` on the range input. */
    handlers: {
      touchstart: onTouchStart,
      touchmove: onTouchMove,
      touchend: onTouchEnd,
      touchcancel: onTouchEnd,
    },
  }
}
