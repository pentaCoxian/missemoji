import type { TileSpec } from '../animation/model'
import type { TextPlacement, PlacedCluster } from './renderTextLayer'

/** Safety cap on repeated copies (huge gaps / tiny text). */
const MAX_COPIES = 12

/**
 * Replicate the placed text along the x axis at one period (text width + gap),
 * shifted by the tile phase, keeping only the copies that intersect the
 * visible canvas. Every text pass then draws all copies in one call, and the
 * canvas edge clips them — a seamless marquee.
 *
 * Placement coordinates are unstretched; the visible window and the gap are
 * converted with `stretchX` so the motion is correct under block stretch.
 */
export function tilePlacement(
  placement: TextPlacement,
  tile: TileSpec,
  renderW: number,
): TextPlacement {
  const clusters = placement.clusters
  if (clusters.length === 0) return placement
  const sx = placement.stretchX || 1

  let minX = Infinity
  let maxX = -Infinity
  for (const c of clusters) {
    if (c.x < minX) minX = c.x
    if (c.x + c.advance > maxX) maxX = c.x + c.advance
  }
  const textW = Math.max(...placement.lineWidths, maxX - minX)
  const period = textW + (tile.gap * renderW) / sx
  if (!(period > 0)) return placement

  // scroll right-to-left: phase 0 = the layout position, phase→1 = one period left
  const offset = -tile.phase * period

  // visible window in unstretched coordinates (stretch is around the centre)
  const cx = renderW / 2
  const vx0 = cx - renderW / 2 / sx
  const vx1 = cx + renderW / 2 / sx
  const kMin = Math.ceil((vx0 - maxX - offset) / period)
  const kMax = Math.floor((vx1 - minX - offset) / period)
  if (kMax < kMin) return { ...placement, clusters: [] }

  const out: PlacedCluster[] = []
  let copies = 0
  for (let k = kMin; k <= kMax && copies < MAX_COPIES; k++, copies++) {
    const shift = offset + k * period
    for (const c of clusters) out.push({ ...c, x: c.x + shift })
  }
  return { ...placement, clusters: out }
}
