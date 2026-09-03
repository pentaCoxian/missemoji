import type { AnimationSpec } from '../project/schema'
import type { FrameState } from './model'
import { IDENTITY_FRAME } from './model'
import { getPreset, presetDefaults, type AnimationPreset } from './presets'
import { remapProgress } from './timing'

/**
 * Resolve the effective numeric params for a preset: user overrides (clamped
 * to the ParamDef range, rounded when `integer`) on top of the defaults.
 */
export function resolveParams(
  preset: AnimationPreset,
  overrides: AnimationSpec['params'],
): Record<string, number> {
  const params = presetDefaults(preset)
  for (const def of preset.params) {
    const v = overrides[def.key]
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    let clamped = Math.min(def.max, Math.max(def.min, v))
    if (def.integer) clamped = Math.round(clamped)
    params[def.key] = clamped
  }
  return params
}

/**
 * Sample the FrameState for a given loop progress (0..1) from the project's
 * active animation preset (spec §10), after applying the loop timing controls
 * (direction / hold / phase). Returns identity when animation is disabled or
 * the preset is unknown.
 */
export function sampleFrameState(anim: AnimationSpec, progress: number): FrameState {
  if (!anim.enabled) return IDENTITY_FRAME
  const preset = getPreset(anim.preset)
  if (!preset) return IDENTITY_FRAME
  return preset.sample(remapProgress(progress, anim), resolveParams(preset, anim.params))
}
