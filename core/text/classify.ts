/**
 * Script predicates for grapheme clusters (spec §7.1). They pick the layout
 * strategy: Latin text breaks on spaces, Japanese text can break between most
 * clusters (subject to kinsoku rules in ./japaneseRules).
 */

const RE_SPACE = /^\s+$/u
// Hiragana, Katakana, CJK unified ideographs, halfwidth katakana.
const RE_JP = /[぀-ゟ゠-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾝ]/u

/** True if the text contains any Japanese (used to pick layout strategy). */
export function hasJapanese(clusters: string[]): boolean {
  return clusters.some((c) => RE_JP.test(c))
}

/** True if the text contains spaces (Latin-style wrapping is viable). */
export function hasSpaces(clusters: string[]): boolean {
  return clusters.some((c) => RE_SPACE.test(c))
}
