import type { Ctx2D } from '../render/renderContext'
import type { FontSpec } from '../project/schema'

/** Build a CSS font shorthand string from a FontSpec at a given px size. */
export function cssFont(font: FontSpec, sizePx: number): string {
  const style = font.style === 'italic' ? 'italic ' : ''
  return `${style}${font.weight} ${sizePx}px '${font.family}', sans-serif`
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
): TextMetricsResult {
  ctx.font = cssFont(font, sizePx)
  ctx.textBaseline = 'alphabetic'

  let width = 0
  let ascent = 0
  let descent = 0

  for (const c of clusters) {
    const m = ctx.measureText(c)
    width += m.width + font.letterSpacing
    const a =
      m.actualBoundingBoxAscent ||
      m.fontBoundingBoxAscent ||
      sizePx * 0.8
    const d =
      m.actualBoundingBoxDescent ||
      m.fontBoundingBoxDescent ||
      sizePx * 0.2
    if (a > ascent) ascent = a
    if (d > descent) descent = d
  }
  // Remove the trailing letter-spacing added after the last cluster.
  if (clusters.length > 0) width -= font.letterSpacing

  return { width: Math.max(0, width), ascent, descent }
}

/**
 * Small LRU cache for run measurements, keyed by font identity + size bucket +
 * cluster content. Size is bucketed to 0.5px to bound entries during the fit
 * binary-search.
 */
const cache = new Map<string, TextMetricsResult>()
const MAX_ENTRIES = 4000

function key(font: FontSpec, sizePx: number, clusters: string[]): string {
  const bucket = Math.round(sizePx * 2) / 2
  return [
    font.family,
    font.weight,
    font.style,
    font.letterSpacing,
    bucket,
    clusters.join(''),
  ].join('|')
}

export function measureRunCached(
  ctx: Ctx2D,
  font: FontSpec,
  sizePx: number,
  clusters: string[],
): TextMetricsResult {
  const k = key(font, sizePx, clusters)
  const hit = cache.get(k)
  if (hit) {
    // refresh LRU position
    cache.delete(k)
    cache.set(k, hit)
    return hit
  }
  const result = measureRun(ctx, font, sizePx, clusters)
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
