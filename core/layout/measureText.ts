import type { Ctx2D } from '../render/renderContext'
import type { FontSpec } from '../project/schema'

/** Build a CSS font shorthand string from a FontSpec at a given px size. */
export function cssFont(font: FontSpec, sizePx: number): string {
  const style = font.style === 'italic' ? 'italic ' : ''
  return `${style}${font.weight} ${sizePx}px '${font.family}', sans-serif`
}

/** First argument that is a real number; lets a legitimate 0 through. */
function firstFinite(...values: (number | undefined)[]): number {
  for (const v of values) if (typeof v === 'number' && Number.isFinite(v)) return v
  return 0
}

export interface TextMetricsResult {
  width: number
  ascent: number
  descent: number
}

/**
 * Measure a run of text at `sizePx`. Applies letter spacing manually (canvas
 * `letterSpacing` support is uneven across engines/workers). Uses actual glyph
 * ascent/descent when available, falling back to font-bounding metrics.
 */
export function measureRun(
  ctx: Ctx2D,
  font: FontSpec,
  sizePx: number,
  clusters: string[],
  /** letter spacing in the SAME px space as `sizePx` (already resolved) */
  letterSpacingPx = 0,
): TextMetricsResult {
  ctx.font = cssFont(font, sizePx)
  ctx.textBaseline = 'alphabetic'

  let width = 0
  // start below any real metric so a run whose ink stops ABOVE the baseline
  // (a negative descent, e.g. "ABC" in some faces) is represented honestly
  // rather than floored to 0, which would over-state the block's height
  let ascent = -Infinity
  let descent = -Infinity

  for (const c of clusters) {
    const m = ctx.measureText(c)
    width += m.width + letterSpacingPx
    // `??`, never `||`: a glyph that sits exactly on the baseline reports an
    // actual descent of 0 (Arial does this for "A" and "B"), and `||` would
    // mistake that for a missing metric and substitute the FONT descent —
    // ~21% of the size — inflating the measured block and pushing text off
    // centre. Only fall back when the metric is genuinely absent.
    const a = firstFinite(m.actualBoundingBoxAscent, m.fontBoundingBoxAscent, sizePx * 0.8)
    const d = firstFinite(m.actualBoundingBoxDescent, m.fontBoundingBoxDescent, sizePx * 0.2)
    if (a > ascent) ascent = a
    if (d > descent) descent = d
  }
  // Remove the trailing letter-spacing added after the last cluster.
  if (clusters.length > 0) width -= letterSpacingPx

  return {
    width: Math.max(0, width),
    ascent: Number.isFinite(ascent) ? ascent : 0,
    descent: Number.isFinite(descent) ? descent : 0,
  }
}

/**
 * Small LRU cache for run measurements, keyed by font identity + size bucket +
 * cluster content. Size is bucketed to 0.5px to bound entries during the fit
 * binary-search.
 */
const cache = new Map<string, TextMetricsResult>()
const MAX_ENTRIES = 4000

function key(font: FontSpec, sizePx: number, clusters: string[], letterSpacingPx: number): string {
  const bucket = Math.round(sizePx * 2) / 2
  return [
    font.family,
    font.weight,
    font.style,
    Math.round(letterSpacingPx * 100) / 100,
    bucket,
    clusters.join(''),
  ].join('|')
}

export function measureRunCached(
  ctx: Ctx2D,
  font: FontSpec,
  sizePx: number,
  clusters: string[],
  letterSpacingPx = 0,
): TextMetricsResult {
  const k = key(font, sizePx, clusters, letterSpacingPx)
  const hit = cache.get(k)
  if (hit) {
    // refresh LRU position
    cache.delete(k)
    cache.set(k, hit)
    return hit
  }
  const result = measureRun(ctx, font, sizePx, clusters, letterSpacingPx)
  cache.set(k, result)
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  return result
}

/** Clear the measurement cache (call when a font finishes loading). */
export function clearMeasureCache() {
  cache.clear()
}
