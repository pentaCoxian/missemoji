import type { FontDescriptor } from './catalog'
import { buildCss2Url, parseFontFaces } from './googleFontsCss'
import type { FontFaceSource } from './fontSource'

/**
 * Load a Google font family so canvas `measureText`/`fillText` can render it
 * (spec §8).
 *
 * Why a proxy: `fonts.googleapis.com/css2` does NOT send CORS headers, so the
 * browser can't `fetch()` the stylesheet directly (the earlier CORS errors).
 * We fetch the CSS through a same-origin Nitro route (`/api/font-css`), parse
 * every @font-face's gstatic src URL (the font files ARE CORS-enabled), and
 * construct FontFace objects — the reliable path for canvas. (Injecting a
 * <link> avoids CORS too but leaves the CSS faces `unloaded` for canvas use.)
 *
 * Returns the weights confirmed loaded. Cached by (family, weights).
 */

const inflight = new Map<string, Promise<number[]>>()
const done = new Set<string>()
const injectedLinks = new Set<string>()
/** Parsed @font-face sources per family (proxy path only), for the render worker. */
const sourcesByFamily = new Map<string, FontFaceSource[]>()

/**
 * The face sources recorded when `family` was loaded through the proxy path,
 * or null when it was loaded via the `<link>` fallback (no CSS to parse) or
 * not loaded at all. Workers cannot fetch the Google CSS themselves.
 */
export function getFontFaceSources(family: string): FontFaceSource[] | null {
  return sourcesByFamily.get(family) ?? null
}

function cacheKey(descriptor: FontDescriptor, weights: number[]) {
  return `${descriptor.family}|${weights.join(',')}`
}

/**
 * Fallback for static hosting (no Nitro server / no /api proxy): inject a
 * <link rel=stylesheet> and nudge the FontFaceSet to load the family. Less
 * reliable for canvas than the proxy path but keeps the app usable when no
 * server is present.
 */
async function loadViaLink(
  descriptor: FontDescriptor,
  weights: number[],
  probe: string,
): Promise<number[]> {
  const url = buildCss2Url(descriptor, { weights })
  if (!injectedLinks.has(url)) {
    injectedLinks.add(url)
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  }
  // Force the browser to fetch the subset by measuring the text in the font.
  await Promise.all(
    weights.map((w) =>
      (document.fonts as FontFaceSet)
        .load(`${w} 24px '${descriptor.family}'`, probe)
        .catch(() => undefined),
    ),
  )
  await (document.fonts as FontFaceSet).ready
  return weights
}

export async function loadGoogleFont(
  descriptor: FontDescriptor,
  opts: { weights?: number[]; text?: string } = {},
): Promise<number[]> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') {
    return []
  }

  const weights = opts.weights && opts.weights.length ? opts.weights : descriptor.weights
  const key = cacheKey(descriptor, weights)
  if (done.has(key)) return weights
  const existing = inflight.get(key)
  if (existing) return existing

  const promise = (async () => {
    // Full-family CSS (no text= subset): the text changes per keystroke, so a
    // subsetted face would miss newly-typed glyphs.
    const googleUrl = buildCss2Url(descriptor, { weights })
    const proxyUrl = `/api/font-css?url=${encodeURIComponent(googleUrl)}`
    const probe = opts.text && opts.text.length ? opts.text.slice(0, 16) : 'Aあ亜'

    let css: string | null = null
    try {
      const r = await fetch(proxyUrl)
      if (r.ok) css = await r.text()
    } catch {
      css = null
    }

    // No same-origin proxy (e.g. static-hosted SPA) -> <link> fallback.
    if (!css) {
      done.add(key)
      return loadViaLink(descriptor, weights, probe)
    }

    const faces = parseFontFaces(css)
    sourcesByFamily.set(
      descriptor.family,
      faces.map((f) => ({
        family: descriptor.family,
        weight: f.weight,
        style: f.style,
        unicodeRange: f.unicodeRange,
        url: f.src,
      })),
    )
    const loaded = new Set<number>()

    await Promise.all(
      faces.map(async (face) => {
        try {
          const ff = new FontFace(descriptor.family, `url(${face.src})`, {
            weight: String(face.weight),
            style: face.style,
            display: 'swap',
            unicodeRange: face.unicodeRange,
          })
          // add before load: Safari matches faces more reliably that way
          ;(document.fonts as FontFaceSet).add(ff)
          await ff.load()
          loaded.add(face.weight)
        } catch {
          // a subset/weight may fail to load; others can still succeed
        }
      }),
    )

    await (document.fonts as FontFaceSet).ready
    done.add(key)
    return loaded.size ? [...loaded] : weights
  })()

  inflight.set(key, promise)
  try {
    return await promise
  } finally {
    inflight.delete(key)
  }
}
