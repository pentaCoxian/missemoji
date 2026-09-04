/**
 * Parse what a user pastes from Google Fonts into a font request.
 *
 * Three shapes are accepted (all are things you can actually copy from the
 * site):
 *   - a CSS2 URL, from the "@import" / "<link>" snippet, e.g.
 *     https://fonts.googleapis.com/css2?family=Rampart+One&display=swap
 *     https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;1,700
 *   - a specimen page URL from the address bar, e.g.
 *     https://fonts.google.com/specimen/Rampart+One
 *   - a share URL from the "Share" button, which carries the selection in a
 *     query parameter and separates families with `|`, e.g.
 *     https://fonts.google.com/share?selection.family=M+PLUS+U:wght@100..900
 *
 * A URL may name several families; all of them are returned. Weights and
 * italics are read from the `:wght@` / `:ital,wght@` axis when present; a
 * variable range (`100..900`) expands to the standard weights it covers.
 */

export interface ParsedFontRequest {
  family: string
  /** weights named in the URL, ascending; empty when the URL did not say */
  weights: number[]
  /** true when the URL asked for italic faces */
  italic: boolean
}

export type FontUrlError =
  | 'empty'
  | 'not-google-fonts'
  | 'no-family'
  /** a Google Fonts URL we understand the host of, but not the shape */
  | 'unsupported'

export type ParseFontUrlResult =
  { ok: true; requests: ParsedFontRequest[] } | { ok: false; error: FontUrlError }

const CSS_HOSTS = new Set(['fonts.googleapis.com'])
const SITE_HOSTS = new Set(['fonts.google.com', 'www.fonts.google.com'])

/** Google writes spaces as `+` in both URL shapes. */
function decodeFamily(raw: string): string {
  return decodeURIComponent(raw.trim()).replace(/\+/g, ' ').trim()
}

/**
 * Parse the axis part of `family=Name:ital,wght@0,400;1,700` (everything after
 * the first `:`). Returns the weights and whether italics were requested.
 */
function parseAxis(spec: string): { weights: number[]; italic: boolean } {
  const at = spec.indexOf('@')
  if (at < 0) return { weights: [], italic: false }
  const axes = spec.slice(0, at).split(',')
  const tuples = spec.slice(at + 1).split(';')
  const italIndex = axes.indexOf('ital')
  const wghtIndex = axes.indexOf('wght')

  const weights = new Set<number>()
  let italic = false
  for (const tuple of tuples) {
    const parts = tuple.split(',')
    if (italIndex >= 0 && parts[italIndex] === '1') italic = true
    const raw = wghtIndex >= 0 ? parts[wghtIndex] : axes.length === 1 ? parts[0] : undefined
    for (const w of expandWeightSpec(raw ?? '')) weights.add(w)
  }
  return { weights: [...weights].sort((a, b) => a - b), italic }
}

/** The weights Google serves for a variable family, and that a UI can offer. */
const STANDARD_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900]

function validWeight(n: number): boolean {
  return Number.isFinite(n) && n >= 1 && n <= 1000
}

/**
 * Expand one weight spec into concrete weights: `700` is itself, while a
 * variable range `100..900` becomes every standard weight it covers (plus its
 * endpoints), so the weight picker offers the whole range rather than just the
 * two extremes.
 */
function expandWeightSpec(spec: string): number[] {
  const range = spec.split('..')
  if (range.length === 1) {
    const n = Number(range[0])
    return validWeight(n) ? [Math.round(n)] : []
  }
  const lo = Number(range[0])
  const hi = Number(range[range.length - 1])
  if (!validWeight(lo) || !validWeight(hi) || hi < lo) return []
  const inside = STANDARD_WEIGHTS.filter((w) => w >= lo && w <= hi)
  return [...new Set([Math.round(lo), ...inside, Math.round(hi)])]
}

/** Parse one `family=` value: `Name` or `Name:axis@tuples`. */
function parseFamilyParam(value: string): ParsedFontRequest | null {
  const colon = value.indexOf(':')
  const family = decodeFamily(colon < 0 ? value : value.slice(0, colon))
  if (!family) return null
  const { weights, italic } =
    colon < 0 ? { weights: [], italic: false } : parseAxis(value.slice(colon + 1))
  return { family, weights, italic }
}

export function parseGoogleFontUrl(input: string): ParseFontUrlResult {
  const text = input.trim()
  if (!text) return { ok: false, error: 'empty' }

  // Tolerate a pasted <link ...> or @import url(...) snippet.
  const fromMarkup = /https?:\/\/[^\s"')]+/.exec(text)
  const candidate = fromMarkup ? fromMarkup[0] : text

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return { ok: false, error: 'not-google-fonts' }
  }

  if (CSS_HOSTS.has(url.hostname)) {
    const families = url.searchParams.getAll('family')
    const requests = families.map(parseFamilyParam).filter((r): r is ParsedFontRequest => !!r)
    if (requests.length === 0) return { ok: false, error: 'no-family' }
    return { ok: true, requests }
  }

  if (SITE_HOSTS.has(url.hostname)) {
    // The "Share" button's URL: ?selection.family=Name:axis@tuples, with `|`
    // between families. searchParams has already turned `+` into spaces.
    const selection = url.searchParams.get('selection.family')
    if (selection) {
      const requests = selection
        .split('|')
        .map((part) => parseFamilyParam(part))
        .filter((r): r is ParsedFontRequest => !!r)
      if (requests.length === 0) return { ok: false, error: 'no-family' }
      return { ok: true, requests }
    }

    // /specimen/Rampart+One, optionally with more path segments after it
    const parts = url.pathname.split('/').filter(Boolean)
    const i = parts.indexOf('specimen')
    const raw = i >= 0 ? parts[i + 1] : undefined
    if (!raw) return { ok: false, error: 'unsupported' }
    const family = decodeFamily(raw)
    if (!family) return { ok: false, error: 'no-family' }
    return { ok: true, requests: [{ family, weights: [], italic: false }] }
  }

  return { ok: false, error: 'not-google-fonts' }
}

/** A human-readable reason a paste was rejected. */
export function describeFontUrlError(error: FontUrlError): string {
  switch (error) {
    case 'empty':
      return 'Paste a Google Fonts link first.'
    case 'no-family':
      return "That link doesn't name a font family."
    case 'unsupported':
      return 'Use a font’s specimen page link, e.g. fonts.google.com/specimen/Rampart+One'
    default:
      return 'That is not a Google Fonts link. Paste a fonts.google.com or fonts.googleapis.com URL.'
  }
}
