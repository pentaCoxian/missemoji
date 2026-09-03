/**
 * Canvas context abstraction so identical render code runs on the main thread
 * (HTMLCanvasElement / OffscreenCanvas) and inside workers (OffscreenCanvas).
 */

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export interface RenderSurface {
  canvas: AnyCanvas
  ctx: Ctx2D
  width: number
  height: number
}

/** True when OffscreenCanvas is available (workers, modern main threads). */
export function hasOffscreenCanvas(): boolean {
  return typeof OffscreenCanvas !== 'undefined'
}

/**
 * Optional canvas factory override. Lets a non-browser environment (e.g. a
 * headless render test using @napi-rs/canvas) supply its own canvas without the
 * browser code paths ever knowing. No effect in production.
 */
export type CanvasFactory = (width: number, height: number) => AnyCanvas
let canvasFactory: CanvasFactory | null = null
export function setCanvasFactory(factory: CanvasFactory | null) {
  canvasFactory = factory
}

/**
 * Create a render surface. Prefers an injected factory, then OffscreenCanvas
 * (no DOM attach, works in workers), then a detached <canvas> on the main
 * thread.
 */
export function createSurface(width: number, height: number): RenderSurface {
  let canvas: AnyCanvas
  if (canvasFactory) {
    canvas = canvasFactory(width, height)
  } else if (hasOffscreenCanvas()) {
    canvas = new OffscreenCanvas(width, height)
  } else if (typeof document !== 'undefined') {
    const el = document.createElement('canvas')
    el.width = width
    el.height = height
    canvas = el
  } else {
    throw new Error('No canvas implementation available in this environment')
  }

  const ctx = canvas.getContext('2d', {
    alpha: true,
    willReadFrequently: true,
  }) as Ctx2D | null
  if (!ctx) throw new Error('Failed to acquire 2D context')

  return { canvas, ctx, width, height }
}

/** Resize an existing surface in place (clears it). */
export function resizeSurface(s: RenderSurface, width: number, height: number) {
  s.canvas.width = width
  s.canvas.height = height
  s.width = width
  s.height = height
}

/** Read the full RGBA buffer from a surface. */
export function readRGBA(s: RenderSurface): ImageData {
  return s.ctx.getImageData(0, 0, s.width, s.height)
}

/**
 * Feature-detect whether `ctx.filter` (used for blur in glow/shadow) actually
 * works on this context. It is unreliable inside some OffscreenCanvas workers,
 * so effects fall back to a manual box-blur when this returns false.
 */
let _filterSupport: boolean | null = null
export function supportsCanvasFilter(ctx: Ctx2D): boolean {
  if (_filterSupport !== null) return _filterSupport
  try {
    const prev = ctx.filter
    ctx.filter = 'blur(2px)'
    const ok = ctx.filter === 'blur(2px)'
    ctx.filter = prev
    _filterSupport = ok
  } catch {
    _filterSupport = false
  }
  return _filterSupport
}
