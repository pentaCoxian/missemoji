import type { EmojiProject } from '../project/schema'
import { computeSafeMargins } from '../layout/safebox'
import { getPreset } from './presets'
import { resolveParams } from './sampleAnimation'
import type { CharInfo } from './model'

/** Number of loop positions sampled when measuring a preset's reach. */
const SAMPLES = 32
/** Synthetic character count used to probe per-character motion. */
const PROBE_CHARS = 8

interface Extent {
  tx: number
  ty: number
  sx: number
  sy: number
  rot: number
}

/**
 * How much extra single-side margin (final px) the layout must reserve so the
 * active animation never clips, computed from the preset's ACTUAL motion with
 * the user's params (spec §7.3 "animation overshoot").
 *
 * The preset is sampled over the loop; for each sample the content box (the
 * safe box minus this margin) is pushed through translate / scale / rotate and
 * its overflow measured. Because the required margin shrinks the box (and thus
 * the overflow), the result is found by a short damped fixed-point iteration.
 * Per-character motion is folded in conservatively as extra whole-layer motion.
 */
export function computeOvershoot(project: EmojiProject): number {
  const anim = project.animation
  if (!anim.enabled) return 0
  const preset = getPreset(anim.preset)
  if (!preset || preset.clipsToFrame) return 0

  const W = project.export.finalWidth
  const H = project.export.finalHeight
  const params = resolveParams(preset, anim.params)

  // Timing controls only reorder / hold progress, so sampling the raw loop
  // covers every reachable state.
  const extents: Extent[] = []
  for (let i = 0; i < SAMPLES; i++) {
    const s = preset.sample(i / SAMPLES, params)
    let tx = Math.abs(s.layer.translate.x)
    let ty = Math.abs(s.layer.translate.y)
    let sx = Math.abs(s.layer.scale.x)
    let sy = Math.abs(s.layer.scale.y)
    let rot = Math.abs(s.layer.rotate)
    if (s.perChar) {
      let ptx = 0
      let pty = 0
      let psx = 1
      let psy = 1
      let prot = 0
      for (let c = 0; c < PROBE_CHARS; c++) {
        const info: CharInfo = {
          index: c,
          count: PROBE_CHARS,
          line: 0,
          lineCount: 1,
          indexInLine: c,
          lineLength: PROBE_CHARS,
        }
        const t = s.perChar(info)
        ptx = Math.max(ptx, Math.abs(t.translate?.x ?? 0))
        pty = Math.max(pty, Math.abs(t.translate?.y ?? 0))
        psx = Math.max(psx, Math.abs(t.scale?.x ?? 1))
        psy = Math.max(psy, Math.abs(t.scale?.y ?? 1))
        prot = Math.max(prot, Math.abs(t.rotate ?? 0))
      }
      tx += ptx
      ty += pty
      sx *= psx
      sy *= psy
      rot += prot
    }
    extents.push({ tx, ty, sx, sy, rot })
  }

  const base = computeSafeMargins(project, 0).total
  let m = 0
  for (let iter = 0; iter < 12; iter++) {
    const a = W / 2 - base - m
    const b = H / 2 - base - m
    if (a <= 1 || b <= 1) break
    let need = 0
    for (const e of extents) {
      const c = Math.abs(Math.cos(e.rot))
      const s = Math.abs(Math.sin(e.rot))
      const ex = e.sx * (a * c + b * s) + e.tx * W
      const ey = e.sy * (a * s + b * c) + e.ty * H
      need = Math.max(need, ex - a, ey - b)
    }
    const next = Math.max(0, need)
    if (Math.abs(next - m) < 0.01) {
      m = next
      break
    }
    // damped update: the map is contracting but can oscillate for large reach
    m = (m + next) / 2
  }
  return Math.round(m * 100) / 100
}
