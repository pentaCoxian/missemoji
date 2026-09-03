import GraphemeSplitter from 'grapheme-splitter'

let splitter: GraphemeSplitter | null = null

/**
 * Split text into grapheme clusters (spec §7.1), preserving emoji ZWJ
 * sequences, skin-tone modifiers, flags, variation selectors, and dakuten.
 * Uses Intl.Segmenter (baseline 2026) with grapheme-splitter as a fallback.
 */
export function segmentGraphemes(text: string): string[] {
  if (text.length === 0) return []

  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(seg.segment(text), (s) => s.segment)
  }

  if (!splitter) splitter = new GraphemeSplitter()
  return splitter.splitGraphemes(text)
}

/**
 * Split into lines first (on \n), then graphemes within each line. Returns an
 * array of grapheme arrays, one per source line.
 */
export function segmentLines(text: string): string[][] {
  return text.split('\n').map((line) => segmentGraphemes(line))
}
