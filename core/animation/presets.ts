import type { FrameState, LayerTransform, PaintModulators } from './model'
import { IDENTITY_TRANSFORM, IDENTITY_PAINT } from './model'
import { smoothLoopEnvelope, smoothLoopOsc, cycleCosine, breathe } from './easing'

/**
 * Animation preset registry (spec §11).
 *
 * All presets are designed to LOOP SEAMLESSLY: each `sample(0)` equals
 * `sample(1)` and, where possible, velocity matches at the wrap (C¹) so there's
 * no visible kick when the APNG/GIF loops. Motion uses smooth sine-based
 * envelopes (no linear ramps, no elastic snap that breaks the loop), and the
 * default amplitudes/speeds are gentle/slow for a calm feel — the user can dial
 * them up via params.
 *
 * `overshoot` (fraction of emoji size) tells the safe-box solver how much extra
 * room to reserve so motion never clips.
 */
export interface AnimationPreset {
  id: string
  label: string
  overshoot: number
  defaultParams: Record<string, number>
  sample: (progress: number, params: Record<string, number>) => FrameState
}

function frame(
  layer: Partial<LayerTransform>,
  paint: Partial<PaintModulators> = {},
  perChar?: FrameState['perChar'],
): FrameState {
  return {
    layer: {
      ...IDENTITY_TRANSFORM,
      ...layer,
      translate: { ...IDENTITY_TRANSFORM.translate, ...layer.translate },
      scale: { ...IDENTITY_TRANSFORM.scale, ...layer.scale },
    },
    paint: { ...IDENTITY_PAINT, ...paint },
    perChar,
  }
}

const p = (params: Record<string, number>, k: string, d: number) => params[k] ?? d

export const PRESETS: AnimationPreset[] = [
  {
    id: 'pulse',
    label: 'Pulse',
    overshoot: 0.08,
    // gentler, slower breathing
    defaultParams: { amount: 0.06 },
    sample: (t, params) => {
      const a = p(params, 'amount', 0.06)
      // breathe(): smooth 0→1→0 with eased dwell at rest — calm, seamless loop
      const s = 1 + a * breathe(t)
      return frame({ scale: { x: s, y: s } })
    },
  },
  {
    id: 'bounce',
    label: 'Bounce',
    overshoot: 0.16,
    defaultParams: { height: 0.12 },
    sample: (t, params) => {
      const h = p(params, 'height', 0.12)
      // single smooth up-and-down per loop using the C¹ envelope (no velocity
      // discontinuity that abs(sin) would introduce). Slight squash at the top.
      const env = smoothLoopEnvelope(t) // 0 at ends, 1 at middle
      const y = -env * h
      const squash = 1 - env * 0.06
      const stretch = 1 + env * 0.06
      return frame({ translate: { x: 0, y }, scale: { x: stretch, y: squash } })
    },
  },
  {
    id: 'pop',
    label: 'Pop',
    overshoot: 0.16,
    defaultParams: { amount: 0.12 },
    sample: (t, params) => {
      const a = p(params, 'amount', 0.12)
      // a single smooth swell that returns to rest — loop-safe (no elastic snap)
      const s = 1 + a * breathe(t)
      return frame({ scale: { x: s, y: s } })
    },
  },
  {
    id: 'wiggle',
    label: 'Wiggle',
    overshoot: 0.1,
    defaultParams: { degrees: 6 },
    sample: (t, params) => {
      const deg = p(params, 'degrees', 6)
      // smooth oscillation; one full cycle returns to 0 with matched slope
      const rot = ((deg * Math.PI) / 180) * smoothLoopOsc(t)
      return frame({ rotate: rot })
    },
  },
  {
    id: 'shake',
    label: 'Shake',
    overshoot: 0.12,
    // slower, gentler than before (freq 3, smaller amount)
    defaultParams: { amount: 0.05, freq: 3 },
    sample: (t, params) => {
      const a = p(params, 'amount', 0.05)
      const f = Math.max(1, Math.round(p(params, 'freq', 3)))
      // integer frequency keeps the shake seamless across the loop
      const x = Math.sin(t * Math.PI * 2 * f) * a
      return frame({ translate: { x, y: 0 } })
    },
  },
  {
    id: 'float',
    label: 'Float',
    overshoot: 0.1,
    defaultParams: { amount: 0.06 },
    sample: (t, params) => {
      const a = p(params, 'amount', 0.06)
      // gentle drift; both axes are full smooth cycles so they loop seamlessly
      const y = smoothLoopOsc(t) * a
      const x = smoothLoopOsc((t + 0.25) % 1) * a * 0.5
      return frame({ translate: { x, y } })
    },
  },
  {
    id: 'wave',
    label: 'Wave',
    overshoot: 0.12,
    defaultParams: { amount: 0.1 },
    sample: (t, params) => {
      const a = p(params, 'amount', 0.1)
      // per-character vertical wave; each char is a full smooth cycle (phase
      // shifted), so the whole word loops seamlessly
      return frame({}, {}, (i, count) => {
        const phase = count > 1 ? i / count : 0
        const y = Math.sin((t + phase) * Math.PI * 2) * a
        return { translate: { x: 0, y } }
      })
    },
  },
  {
    id: 'glow-pulse',
    label: 'Glow Pulse',
    overshoot: 0.04,
    defaultParams: { min: 0.5, max: 1.3 },
    sample: (t, params) => {
      const min = p(params, 'min', 0.5)
      const max = p(params, 'max', 1.3)
      // smooth seamless swell of glow intensity (breathe spends more time calm)
      const g = min + (max - min) * breathe(t)
      // tiny synchronized scale so the glow feels alive without clipping
      const s = 1 + 0.02 * breathe(t)
      void cycleCosine // (kept available for alt curves)
      return frame({ scale: { x: s, y: s } }, { glowIntensity: g })
    },
  },
]

const PRESET_MAP = new Map(PRESETS.map((pr) => [pr.id, pr]))

export function getPreset(id: string): AnimationPreset | undefined {
  return PRESET_MAP.get(id)
}

/** Overshoot fraction for a preset id (0 if unknown / static). */
export function presetOvershoot(id: string): number {
  return PRESET_MAP.get(id)?.overshoot ?? 0
}
