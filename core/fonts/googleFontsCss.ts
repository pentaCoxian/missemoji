import type { FontDescriptor } from './catalog'

/**
 * Build a keyless Google Fonts CSS2 URL (spec §8). No Developer API key needed.
 * Optionally subsets with `text=` to fetch only the glyphs in the emoji text,
 * which keeps JP font downloads tiny. We always include the requested weight.
 */
export function buildCss2Url(
  descriptor: FontDescriptor,
  opts: { weights?: number[]; text?: string } = {},
): string {
  const family = descriptor.family.replace(/ /g, '+')
  const weights = (opts.weights && opts.weights.length
    ? opts.weights
    : descriptor.weights
  )
    .slice()
    .sort((a, b) => a - b)

  const params: string[] = [`family=${family}:wght@${weights.join(';')}`]
  if (opts.text && opts.text.length > 0) {
    params.push(`text=${encodeURIComponent(opts.text)}`)
  }
  params.push('display=swap')
  return `https://fonts.googleapis.com/css2?${params.join('&')}`
}
