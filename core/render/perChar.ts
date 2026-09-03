import type { PerCharFn } from '../animation/model'
import type { TextPlacement, ResolvedCharTransform } from './renderTextLayer'

/**
 * Resolve a frame's per-character motion into the placement, once per frame.
 * Every text pass (shadow / glow / stroke / fill) then draws the same resolved
 * placement, so per-glyph motion stays registered across layers.
 *
 * Translate is a canvas fraction (see animation/model.ts). The placement is in
 * UNSTRETCHED coordinates and the block stretch is applied on top, so offsets
 * are divided by the stretch factors to keep their visual amplitude.
 */
export function applyPerChar(
  placement: TextPlacement,
  fn: PerCharFn | undefined,
  renderW: number,
  renderH: number,
): TextPlacement {
  if (!fn || placement.clusters.length === 0) return placement

  const count = placement.clusters.length
  const sxBlock = placement.stretchX || 1
  const syBlock = placement.stretchY || 1
  const lineLengths = new Array<number>(placement.lineCount).fill(0)
  for (const c of placement.clusters) lineLengths[c.line] = (lineLengths[c.line] ?? 0) + 1

  const clusters = placement.clusters.map((c) => {
    const t = fn({
      index: c.index,
      count,
      line: c.line,
      lineCount: placement.lineCount,
      indexInLine: c.indexInLine,
      lineLength: lineLengths[c.line] ?? 1,
    })
    const resolved: ResolvedCharTransform = {
      dx: ((t.translate?.x ?? 0) * renderW) / sxBlock,
      dy: ((t.translate?.y ?? 0) * renderH) / syBlock,
      sx: t.scale?.x ?? 1,
      sy: t.scale?.y ?? 1,
      rot: t.rotate ?? 0,
    }
    const identity =
      resolved.dx === 0 &&
      resolved.dy === 0 &&
      resolved.sx === 1 &&
      resolved.sy === 1 &&
      resolved.rot === 0
    return identity ? c : { ...c, transform: resolved }
  })

  return { ...placement, clusters }
}
