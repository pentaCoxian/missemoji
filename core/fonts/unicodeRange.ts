import type { FontFaceSource } from './fontSource'

export type CodePointRange = [number, number]

/**
 * Parse a CSS `unicode-range` value: `U+0041`, `U+0000-00FF`, `U+30??`
 * (wildcards), comma separated. Malformed tokens are skipped.
 */
export function parseUnicodeRange(value: string): CodePointRange[] {
  const out: CodePointRange[] = []
  for (const raw of value.split(',')) {
    const tok = raw.trim().toUpperCase()
    if (!tok.startsWith('U+')) continue
    const body = tok.slice(2)
    if (body.includes('?')) {
      const lo = body.replace(/\?/g, '0')
      const hi = body.replace(/\?/g, 'F')
      if (/^[0-9A-F]+$/.test(lo)) out.push([parseInt(lo, 16), parseInt(hi, 16)])
      continue
    }
    const m = /^([0-9A-F]+)(?:-([0-9A-F]+))?$/.exec(body)
    if (!m) continue
    const lo = parseInt(m[1]!, 16)
    const hi = m[2] ? parseInt(m[2], 16) : lo
    if (hi >= lo) out.push([lo, hi])
  }
  return out
}

export function textCodePoints(text: string): Set<number> {
  const set = new Set<number>()
  for (const ch of text) set.add(ch.codePointAt(0)!)
  return set
}

export function rangesIntersect(ranges: CodePointRange[], cps: Set<number>): boolean {
  for (const cp of cps) {
    for (const [lo, hi] of ranges) if (cp >= lo && cp <= hi) return true
  }
  return false
}

/**
 * Pick the faces a piece of text actually needs: unranged faces always, ranged
 * (subset) faces only when they cover one of the text's code points, and only
 * the requested weights / style when given. Keeps worker font loads small for
 * JP families.
 */
export function selectFacesForText(
  faces: FontFaceSource[],
  text: string,
  opts: { weights?: number[]; style?: 'normal' | 'italic' } = {},
): FontFaceSource[] {
  const cps = textCodePoints(text)
  return faces.filter((f) => {
    if (opts.weights && opts.weights.length && !opts.weights.includes(f.weight)) return false
    if (opts.style && f.style !== opts.style) return false
    if (!f.unicodeRange) return true
    return rangesIntersect(parseUnicodeRange(f.unicodeRange), cps)
  })
}
