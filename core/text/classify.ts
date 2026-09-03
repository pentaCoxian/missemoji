/**
 * Classify a grapheme cluster's script/category (spec §7.1). Drives break-point
 * selection (Latin breaks on spaces; JP can break between most clusters) and
 * kinsoku handling.
 */

export type ClusterClass =
  | 'jp' // hiragana / katakana / kanji / CJK
  | 'latin'
  | 'digit'
  | 'punct'
  | 'space'
  | 'emoji'
  | 'other'

const RE_SPACE = /^\s+$/u
const RE_DIGIT = /^[0-9０-９]+$/u
const RE_LATIN = /^[A-Za-zÀ-ÿĀ-ž]+$/u
const RE_PUNCT = /^[!-/:-@[-`{-~、-〿！-／：-＠［-｀｛-～。、，．・「」『』（）]+$/u
// Hiragana, Katakana, CJK unified ideographs, halfwidth katakana.
const RE_JP = /[぀-ゟ゠-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾝ]/u
// Rough emoji detection (pictographic / symbol ranges + ZWJ presence).
const RE_EMOJI = /\p{Extended_Pictographic}|[☀-➿\u{1F000}-\u{1FAFF}]/u

export function classifyCluster(cluster: string): ClusterClass {
  if (RE_SPACE.test(cluster)) return 'space'
  if (RE_EMOJI.test(cluster)) return 'emoji'
  if (RE_JP.test(cluster)) return 'jp'
  if (RE_DIGIT.test(cluster)) return 'digit'
  if (RE_LATIN.test(cluster)) return 'latin'
  if (RE_PUNCT.test(cluster)) return 'punct'
  return 'other'
}

/** True if the text contains any Japanese (used to pick layout strategy). */
export function hasJapanese(clusters: string[]): boolean {
  return clusters.some((c) => RE_JP.test(c))
}

/** True if the text contains spaces (Latin-style wrapping is viable). */
export function hasSpaces(clusters: string[]): boolean {
  return clusters.some((c) => RE_SPACE.test(c))
}
