import type { FrameState, LayerTransform, PaintModulators } from './model'
import { IDENTITY_TRANSFORM, IDENTITY_PAINT } from './model'
import { smoothLoopEnvelope, smoothLoopOsc, breathe } from './easing'

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
 * Length-like params (amount, height) are FRACTIONS of the final emoji size;
 * the renderer multiplies by the canvas dimensions.
 *
 * The safe-box reserve for motion is not declared here: core/animation/
 * overshoot.ts measures each preset's actual reach with the user's params.
 */

/** A user-tunable preset parameter, with the UI metadata to edit it. */
export interface ParamDef {
  key: string
  label: string
  min: number
  max: number
  step: number
  default: number
  /** display suffix, e.g. '°' */
  unit?: string
  /** round to an integer when sampling (e.g. an oscillation count) */
  integer?: boolean
}

export interface AnimationPreset {
  id: string
  label: string
  params: ParamDef[]
  /** true when the preset deliberately runs content off the canvas edge (no reserve) */
  clipsToFrame?: boolean
  sample: (progress: number, params: Record<string, number>) => FrameState
}

/** The default parameter values of a preset, keyed by param key. */
export function presetDefaults(preset: AnimationPreset): Record<string, number> {
  const out: Record<string, number> = {}
  for (const def of preset.params) out[def.key] = def.default
  return out
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
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
/** Saturating sine shaper: hard-edged motion that still has integer-cycle loops. */
const hard = (v: number) => clamp(1.6 * v, -1, 1)
const TAU = Math.PI * 2

const amount = (def: number, min: number, max: number): ParamDef => ({
  key: 'amount',
  label: 'Amount',
  min,
  max,
  step: 0.01,
  default: def,
})

export const PRESETS: AnimationPreset[] = [
  {
    id: 'pulse',
    label: 'Pulse',
    // gentler, slower breathing
    params: [amount(0.06, 0.01, 0.3)],
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
    params: [{ key: 'height', label: 'Height', min: 0.02, max: 0.35, step: 0.01, default: 0.12 }],
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
    params: [amount(0.12, 0.02, 0.4)],
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
    params: [
      {
        key: 'degrees',
        label: 'Angle',
        min: 1,
        max: 30,
        step: 1,
        default: 6,
        unit: '°',
        integer: true,
      },
    ],
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
    params: [
      amount(0.05, 0.01, 0.15),
      { key: 'freq', label: 'Speed', min: 1, max: 8, step: 1, default: 3, integer: true },
    ],
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
    params: [amount(0.06, 0.01, 0.15)],
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
    params: [amount(0.1, 0.02, 0.25)],
    sample: (t, params) => {
      const a = p(params, 'amount', 0.1)
      // per-character vertical wave; each char is a full smooth cycle (phase
      // shifted), so the whole word loops seamlessly
      return frame({}, {}, (c) => {
        const phase = c.count > 1 ? c.index / c.count : 0
        const y = Math.sin((t + phase) * Math.PI * 2) * a
        return { translate: { x: 0, y } }
      })
    },
  },
  {
    id: 'glow-pulse',
    label: 'Glow Pulse',
    params: [
      { key: 'min', label: 'Min glow', min: 0, max: 2, step: 0.05, default: 0.5 },
      { key: 'max', label: 'Max glow', min: 0, max: 2, step: 0.05, default: 1.3 },
    ],
    sample: (t, params) => {
      const min = p(params, 'min', 0.5)
      const max = p(params, 'max', 1.3)
      // smooth seamless swell of glow intensity (breathe spends more time calm)
      const g = min + (max - min) * breathe(t)
      // tiny synchronized scale so the glow feels alive without clipping
      const s = 1 + 0.02 * breathe(t)
      return frame({ scale: { x: s, y: s } }, { glowIntensity: g })
    },
  },

  // --- Misskey classics ---
  {
    id: 'spin',
    label: 'Spin',
    params: [{ key: 'turns', label: 'Turns', min: 1, max: 3, step: 1, default: 1, integer: true }],
    sample: (t, params) => {
      const turns = Math.max(1, Math.round(p(params, 'turns', 1)))
      // whole turns per loop: rotate(1) ≡ rotate(0) mod 2π
      return frame({ rotate: TAU * turns * t })
    },
  },
  {
    id: 'blink',
    label: 'Blink',
    params: [
      { key: 'times', label: 'Blinks', min: 1, max: 4, step: 1, default: 1, integer: true },
      { key: 'softness', label: 'Softness', min: 0, max: 1, step: 0.05, default: 0.3 },
      { key: 'minOpacity', label: 'Min opacity', min: 0, max: 0.9, step: 0.05, default: 0 },
    ],
    sample: (t, params) => {
      const times = Math.max(1, Math.round(p(params, 'times', 1)))
      const soft = Math.max(0.02, p(params, 'softness', 0.3))
      const min = p(params, 'minOpacity', 0)
      // cosine window per blink, sharpened by softness (0 = hard on/off);
      // starts and ends fully visible so the loop is seamless
      const u = (t * times) % 1
      const e = (1 + Math.cos(TAU * u)) / 2
      const v = clamp((e - 0.5) / soft + 0.5, 0, 1)
      return frame({ opacity: min + (1 - min) * v })
    },
  },
  {
    id: 'gangan',
    label: 'Gangan',
    params: [
      amount(0.06, 0.02, 0.15),
      { key: 'freq', label: 'Speed', min: 2, max: 8, step: 1, default: 4, integer: true },
      { key: 'tilt', label: 'Tilt', min: 0, max: 15, step: 1, default: 4, unit: '°' },
    ],
    sample: (t, params) => {
      const a = p(params, 'amount', 0.06)
      const f = Math.max(1, Math.round(p(params, 'freq', 4)))
      const tilt = (p(params, 'tilt', 4) * Math.PI) / 180
      // hard, punchy shake: saturated sines with integer frequencies (seamless)
      const x = a * hard(Math.sin(TAU * f * t))
      const y = 0.5 * a * hard(Math.sin(2 * TAU * f * t))
      const rot = tilt * hard(Math.cos(TAU * f * t))
      return frame({ translate: { x, y }, rotate: rot })
    },
  },
  {
    id: 'rainbow',
    label: 'Rainbow',
    params: [
      { key: 'cycles', label: 'Cycles', min: 1, max: 3, step: 1, default: 1, integer: true },
      { key: 'vivid', label: 'Vividness', min: 0, max: 1, step: 0.05, default: 0.7 },
    ],
    sample: (t, params) => {
      const cycles = Math.max(1, Math.round(p(params, 'cycles', 1)))
      // whole hue turns per loop: hueShift(1) ≡ hueShift(0) mod 360
      return frame({}, { hueShift: 360 * cycles * t, minSaturation: p(params, 'vivid', 0.7) })
    },
  },
]

const PRESET_MAP = new Map(PRESETS.map((pr) => [pr.id, pr]))

export function getPreset(id: string): AnimationPreset | undefined {
  return PRESET_MAP.get(id)
}
