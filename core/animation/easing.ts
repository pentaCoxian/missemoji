/**
 * Easing functions. All take t in [0,1] and return an eased value.
 */

export const linear = (t: number) => t

export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2

export const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

export const easeOutElastic = (t: number) => {
  const c4 = (2 * Math.PI) / 3
  if (t === 0) return 0
  if (t === 1) return 1
  return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
}

export const easeInOutQuad = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2

/** A symmetric loop helper: maps progress 0..1 to 0..1..0 via a sine. */
export const pingPongSine = (t: number) => Math.sin(t * Math.PI)

/** Full-cycle sine, -1..1, for oscillations. */
export const cycleSine = (t: number) => Math.sin(t * Math.PI * 2)

/** Full-cycle cosine, starts and ends at 1 — naturally seamless for looping. */
export const cycleCosine = (t: number) => Math.cos(t * Math.PI * 2)

/**
 * Smooth, seamless 0→1→0 envelope with ZERO velocity at both ends (C¹ loop):
 * `(1 - cos(2πt)) / 2`. Unlike pingPongSine, its derivative is 0 at t=0 and
 * t=1, so a looped animation has no visible "kick" at the wrap point. This is
 * the preferred envelope for loop-friendly, smooth motion.
 */
export const smoothLoopEnvelope = (t: number) => (1 - Math.cos(t * Math.PI * 2)) / 2

/**
 * Seamless oscillation in [-1, 1] with matched endpoints AND velocity, built
 * from a single full sine cycle. `sin(2πt)` already returns to 0 with matching
 * slope at the wrap, so it loops cleanly; exposed for readability.
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
