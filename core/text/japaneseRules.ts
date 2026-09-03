/**
 * Japanese kinsoku shori (禁則処理) line-break rules (spec §7.2).
 * Characters that may not start a line (行頭禁則) and may not end a line
 * (行末禁則). Used to nudge break points and to penalize illegal candidates.
 */

/** Must not appear at the START of a line (closing punctuation, small kana, etc.). */
export const NO_LINE_START = new Set<string>([
  // closing brackets / quotes
  '。',
  '、',
  '，',
  '．',
  '！',
  '？',
  '!',
  '?',
  ')',
  ']',
  '}',
  '）',
  '］',
  '｝',
  '」',
  '』',
  '〕',
  '〉',
  '》',
  '】',
  '”',
  '’',
  // sound marks & repeaters
  '・',
  '：',
  '；',
  '…',
  '‥',
  'ー',
  '〜',
  'ｰ',
  // small kana
  'ぁ',
  'ぃ',
  'ぅ',
  'ぇ',
  'ぉ',
  'っ',
  'ゃ',
  'ゅ',
  'ょ',
  'ゎ',
  'ァ',
  'ィ',
  'ゥ',
  'ェ',
  'ォ',
  'ッ',
  'ャ',
  'ュ',
  'ョ',
  'ヮ',
  // ascii closers/commas
  ',',
  '.',
  ':',
  ';',
])

/** Must not appear at the END of a line (opening brackets / quotes). */
export const NO_LINE_END = new Set<string>([
  '(',
  '[',
  '{',
  '（',
  '［',
  '｛',
  '「',
  '『',
  '〔',
  '〈',
  '《',
  '【',
  '“',
  '‘',
  '¥',
  '＄',
  '$',
])

export function cannotStartLine(cluster: string): boolean {
  return NO_LINE_START.has(cluster)
}

export function cannotEndLine(cluster: string): boolean {
  return NO_LINE_END.has(cluster)
}

/**
 * Count kinsoku violations for a set of lines: a NO_LINE_START char at a line's
 * start, or a NO_LINE_END char at a line's end.
 */
export function countKinsokuViolations(lines: string[][]): number {
  let v = 0
  for (const line of lines) {
    if (line.length === 0) continue
    if (cannotStartLine(line[0]!)) v++
    if (cannotEndLine(line[line.length - 1]!)) v++
  }
  return v
}
