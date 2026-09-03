import type { ExportFormat } from '../project/schema'

/** Max code points kept from the text (never splits a surrogate pair). */
const MAX_NAME_CODEPOINTS = 24

/**
 * Turn emoji text into a filename stem: any Unicode letter / number survives
 * (Japanese, full-width Latin, Hangul…), whitespace becomes `_` (Misskey emoji
 * names use underscores), everything else is dropped.
 */
export function sanitizeName(text: string, maxCodePoints = MAX_NAME_CODEPOINTS): string {
  const cleaned = text
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\p{L}\p{N}_]+/gu, '')
  return Array.from(cleaned).slice(0, maxCodePoints).join('')
}

export function suggestFilename(text: string, format: ExportFormat): string {
  const base = sanitizeName(text) || 'emoji'
  const ext = format === 'apng' ? 'png' : format
  return `${base}.${ext}`
}

/** Make a list of filenames unique by suffixing `_2`, `_3`… before the extension. */
export function uniqueNames(names: string[]): string[] {
  const used = new Set<string>()
  return names.map((name) => {
    if (!used.has(name)) {
      used.add(name)
      return name
    }
    const dot = name.lastIndexOf('.')
    const stem = dot > 0 ? name.slice(0, dot) : name
    const ext = dot > 0 ? name.slice(dot) : ''
    for (let n = 2; ; n++) {
      const candidate = `${stem}_${n}${ext}`
      if (!used.has(candidate)) {
        used.add(candidate)
        return candidate
      }
    }
  })
}
