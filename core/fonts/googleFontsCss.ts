import type { FontDescriptor } from './catalog'

/**
 * Build a keyless Google Fonts CSS2 URL (spec §8). No Developer API key needed.
 * Optionally subsets with `text=` to fetch only the glyphs in the emoji text,
 * which keeps JP font downloads tiny. We always include the requested weight.
 * Families with real italics get both the upright and italic faces
 * (`ital,wght@0,W;1,W`) so switching style needs no reload.
 */
export function buildCss2Url(
  descriptor: FontDescriptor,
  opts: { weights?: number[]; text?: string; italic?: boolean } = {},
): string {
  const family = descriptor.family.replace(/ /g, '+')
  const weights = (opts.weights && opts.weights.length ? opts.weights : descriptor.weights)
    .slice()
    .sort((a, b) => a - b)
  const italic = opts.italic ?? descriptor.italic ?? false

  const axis = italic
    ? `ital,wght@${[...weights.map((w) => `0,${w}`), ...weights.map((w) => `1,${w}`)].join(';')}`
    : `wght@${weights.join(';')}`
  const params: string[] = [`family=${family}:${axis}`]
  if (opts.text && opts.text.length > 0) {
    params.push(`text=${encodeURIComponent(opts.text)}`)
  }
  params.push('display=swap')
  return `https://fonts.googleapis.com/css2?${params.join('&')}`
}

export interface ParsedFace {
  weight: number
  style: 'normal' | 'italic'
  src: string
  unicodeRange?: string
}

/**
 * Parse @font-face blocks from Google CSS2 output: weight, style, the first
 * woff2 url() in src, and the unicode-range (JP fonts ship many subset blocks).
 */
export function parseFontFaces(css: string): ParsedFace[] {
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
