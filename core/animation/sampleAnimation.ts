import type { AnimationSpec } from '../project/schema'
import type { FrameState } from './model'
import { IDENTITY_FRAME } from './model'
import { getPreset } from './presets'

/**
 * Sample the FrameState for a given progress (0..1) from the project's active
 * animation preset (spec §10). Returns identity when animation is disabled or
 * the preset is unknown.
 */
export function sampleFrameState(
  anim: AnimationSpec,
  progress: number,
): FrameState {
  if (!anim.enabled) return IDENTITY_FRAME
  const preset = getPreset(anim.preset)
  if (!preset) return IDENTITY_FRAME

  // Merge preset defaults with user params (numeric only).
  const params: Record<string, number> = { ...preset.defaultParams }
  for (const [k, v] of Object.entries(anim.params)) {
    if (typeof v === 'number') params[k] = v
  }

  return preset.sample(progress, params)
}
