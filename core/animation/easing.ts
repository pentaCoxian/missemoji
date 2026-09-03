/**
 * Loop-friendly easing curves. All take t in [0,1] and return an eased value.
 * Every curve here starts and ends at the same value so a looped animation has
 * no visible seam at the wrap point.
 */

export const linear = (t: number) => t

/**
 * Smooth, seamless 0→1→0 envelope with ZERO velocity at both ends (C¹ loop):
 * `(1 - cos(2πt)) / 2`. Its derivative is 0 at t=0 and t=1, so a looped
 * animation has no visible "kick" at the wrap point. This is the preferred
 * envelope for loop-friendly, smooth motion.
 */
export const smoothLoopEnvelope = (t: number) => (1 - Math.cos(t * Math.PI * 2)) / 2

/**
 * Seamless oscillation in [-1, 1] with matched endpoints AND velocity, built
 * from a single full sine cycle. `sin(2πt)` returns to 0 with matching slope at
 * the wrap, so it loops cleanly; exposed for readability.
 */
export const smoothLoopOsc = (t: number) => Math.sin(t * Math.PI * 2)

/**
 * A gentle "breathing" curve in [0,1], biased to spend more time near rest for
 * a calmer, slower feel: smoothstep applied to the loop envelope.
 */
export const breathe = (t: number) => {
  const e = smoothLoopEnvelope(t)
  return e * e * (3 - 2 * e)
}
