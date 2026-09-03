import type { Ctx2D } from '../render/renderContext'
import type { FillSpec, GradientStop } from '../project/schema'
import { parseColor, mixColor } from './color'

/**
 * Build a CanvasGradient for a linear-gradient fill.
 *
 * Per request: the gradient is calculated over the ENTIRE frame box (not the
 * tight content bounds) so the sweep is stable regardless of how the text is
 * laid out, and a "color-tolerant feather" inserts interpolated intermediate
 * stops between adjacent colors to smooth the transition and avoid hard banding.
 *
 * `offset` (0..1) shifts the stops for animated gradient sweeps (spec §10).
 */
export function buildLinearGradient(
  ctx: Ctx2D,
  fill: Extract<FillSpec, { type: 'linear-gradient' }>,
  frameBox: { x: number; y: number; w: number; h: number },
  offset = 0,
  featherSteps = 6,
): CanvasGradient {
  const angleRad = (fill.angle * Math.PI) / 180
  const cx = frameBox.x + frameBox.w / 2
  const cy = frameBox.y + frameBox.h / 2
  // Project the gradient line across the full frame's half-diagonal so it spans
  // the whole box at any angle (every visible pixel gets a meaningful color).
  const halfDiag = Math.sqrt(frameBox.w * frameBox.w + frameBox.h * frameBox.h) / 2
  const dx = Math.cos(angleRad) * halfDiag
  const dy = Math.sin(angleRad) * halfDiag

  const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy)

  const stops = featherStops(fill.stops, featherSteps)
  for (const stop of stops) {
    let pos = (stop.position + offset) % 1
    if (pos < 0) pos += 1
    g.addColorStop(clamp01(pos), stop.color)
  }
  return g
}

/**
 * Insert interpolated stops between each adjacent pair so the color transition
 * is feathered/smoothed rather than a hard two-color ramp. Interpolation is in
 * sRGB; alpha is interpolated too so semi-transparent stops blend cleanly.
 */
export function featherStops(stops: GradientStop[], steps: number): GradientStop[] {
  if (stops.length < 2 || steps < 1) return stops.slice()
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  const out: GradientStop[] = []

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!
    const b = sorted[i + 1]!
    out.push(a)
    const ca = parseColor(a.color)
    const cb = parseColor(b.color)
    if (!ca || !cb) continue
    for (let s = 1; s <= steps; s++) {
      const t = s / (steps + 1)
      // smoothstep easing for a softer (color-tolerant) feather
      const e = t * t * (3 - 2 * t)
      out.push({
        position: a.position + (b.position - a.position) * t,
        color: mixColor(ca, cb, e),
      })
    }
  }
  out.push(sorted[sorted.length - 1]!)
  return out
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}
