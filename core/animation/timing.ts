import type { AnimDirection } from '../project/schema'

/** Loop-level timing controls layered on top of a preset's sample(t). */
export interface TimingSpec {
  direction: AnimDirection
  /** fraction of the loop spent at rest (sample(0)), 0..0.5 */
  hold: number
  /** phase offset of the loop start, 0..1 */
  phase: number
}

/**
 * Remap loop progress before sampling a preset. Every mapping keeps the loop
 * seamless given the preset contract `sample(0) == sample(1)`:
 *  - phase rotates the loop start;
 *  - hold pins the first `hold` fraction of the loop at rest (0) and stretches
 *    the remainder over 0..1;
 *  - reverse plays 1→0; pingpong plays 0→1→0 (both ends at rest).
 */
export function remapProgress(t: number, timing: TimingSpec): number {
  let u = (((t + timing.phase) % 1) + 1) % 1
  const h = Math.min(0.5, Math.max(0, timing.hold))
  if (h > 0) u = u < h ? 0 : (u - h) / (1 - h)
  if (timing.direction === 'reverse') return 1 - u
  if (timing.direction === 'pingpong') return u < 0.5 ? 2 * u : 2 - 2 * u
  return u
}
