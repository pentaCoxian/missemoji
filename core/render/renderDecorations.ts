import type { Ctx2D } from './renderContext'
import type { BackgroundSpec } from '../project/schema'

/**
 * Draw the background layer (spec §9 step 2). Decorative shapes (step 3) are a
 * Phase 3+ subset and land later; the seam is here.
 */
export function paintBackground(
  ctx: Ctx2D,
  bg: BackgroundSpec | null,
  width: number,
  height: number,
) {
  if (!bg) return

  if (bg.type === 'solid') {
    ctx.fillStyle = bg.color
    ctx.fillRect(0, 0, width, height)
    return
  }

  // Rounded blob background.
  const pad = bg.padding
  const x = pad
  const y = pad
  const w = width - pad * 2
  const h = height - pad * 2
  const r = Math.min(bg.radius, w / 2, h / 2)

  ctx.fillStyle = bg.color
  roundRect(ctx, x, y, w, h, r)
  ctx.fill()
}

function roundRect(
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
