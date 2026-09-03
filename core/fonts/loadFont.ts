import type { FontDescriptor } from './catalog'
import { buildCss2Url } from './googleFontsCss'

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
          await ff.load()
          ;(document.fonts as FontFaceSet).add(ff)
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

interface ParsedFace {
  weight: number
  style: 'normal' | 'italic'
  src: string
  unicodeRange?: string
}

/**
 * Parse @font-face blocks from Google CSS2 output: weight, style, the first
 * woff2 url() in src, and the unicode-range (JP fonts ship many subset blocks).
 */
function parseFontFaces(css: string): ParsedFace[] {
  const faces: ParsedFace[] = []
  const blockRe = /@font-face\s*{([^}]*)}/g
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(css))) {
    const body = m[1]!
    const weight = Number(/font-weight:\s*(\d+)/.exec(body)?.[1] ?? '400')
    const style = /font-style:\s*italic/.test(body) ? ('italic' as const) : ('normal' as const)
    // Prefer a woff2 url; fall back to the first url().
    const src =
      /url\(([^)]+\.woff2[^)]*)\)/.exec(body)?.[1]?.replace(/['"]/g, '') ??
      /url\(([^)]+)\)/.exec(body)?.[1]?.replace(/['"]/g, '')
    const unicodeRange = /unicode-range:\s*([^;]+);/.exec(body)?.[1]?.trim()
    if (src) faces.push({ weight, style, src, unicodeRange })
  }
  return faces
}
