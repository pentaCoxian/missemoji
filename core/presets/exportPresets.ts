import type { EmojiProject } from '../project/schema'

/**
 * Misskey-oriented export presets (spec §16). Selecting a preset patches the
 * project's export + animation defaults. Sizes/scales/fps chosen to balance
 * quality vs the file-size limits common on Misskey instances.
 */
export interface ExportPreset {
  id: string
  label: string
  description: string
  /** returns a partial patch applied to project.export + project.animation */
  apply: (project: EmojiProject) => void
}

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'static-128',
    label: 'Misskey Static 128',
    description: 'Default static emoji, 128×128 PNG.',
    apply: (p) => {
      p.export.format = 'png'
      p.export.finalWidth = 128
      p.export.finalHeight = 128
      p.export.renderScale = 4
      p.export.optimizeFor = 'quality'
      p.animation.enabled = false
    },
  },
  {
    id: 'static-256',
    label: 'Misskey Static 256',
    description: 'Higher-resolution static emoji, 256×256 PNG.',
    apply: (p) => {
      p.export.format = 'png'
      p.export.finalWidth = 256
      p.export.finalHeight = 256
      p.export.renderScale = 4
      p.export.optimizeFor = 'quality'
      p.animation.enabled = false
    },
  },
  {
    id: 'apng-lite',
    label: 'Misskey APNG Lite',
    description: 'Small animated transparent emoji, 128×128, 12fps.',
    apply: (p) => {
      p.export.format = 'apng'
      p.export.finalWidth = 128
      p.export.finalHeight = 128
      p.export.renderScale = 4
      p.export.optimizeFor = 'size'
      p.animation.enabled = true
      p.animation.fps = 12
      p.animation.durationMs = 1200
      p.animation.loop = true
    },
  },
  {
    id: 'apng-rich',
    label: 'Misskey APNG Rich',
    description: 'Higher-quality animation, 256×256, 18fps.',
    apply: (p) => {
      p.export.format = 'apng'
      p.export.finalWidth = 256
      p.export.finalHeight = 256
      p.export.renderScale = 4
      p.export.optimizeFor = 'balanced'
      p.animation.enabled = true
      p.animation.fps = 18
      p.animation.durationMs = 1400
      p.animation.loop = true
    },
  },
  {
    id: 'experimental',
    label: 'Misskey Experimental',
    description: 'More frames/effects — watch the file-size warning.',
    apply: (p) => {
      p.export.format = 'apng'
      p.export.finalWidth = 256
      p.export.finalHeight = 256
      p.export.renderScale = 8
      p.export.optimizeFor = 'quality'
      p.animation.enabled = true
      p.animation.fps = 24
      p.animation.durationMs = 1600
      p.animation.loop = true
    },
  },
]

const BY_ID = new Map(EXPORT_PRESETS.map((p) => [p.id, p]))
export function getExportPreset(id: string): ExportPreset | undefined {
  return BY_ID.get(id)
}
