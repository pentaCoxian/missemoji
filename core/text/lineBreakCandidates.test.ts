import { describe, it, expect } from 'vitest'
import { createDefaultProject } from '../project/defaults'
import { generateCandidates } from './lineBreakCandidates'
import { countKinsokuViolations } from './japaneseRules'
import { segmentGraphemes } from './segmentGraphemes'

describe('generateCandidates', () => {
  it('produces at least one candidate for short text', () => {
    const p = createDefaultProject()
    p.text = 'やった'
    const cands = generateCandidates(p)
    expect(cands.length).toBeGreaterThan(0)
    expect(cands[0]!.lines.length).toBeGreaterThan(0)
  })

  it('honors layout mode line-count bias for long text', () => {
    const p = createDefaultProject()
    p.text = 'これはとてもながいてすとのぶんしょうです'
    const cands = generateCandidates(p)
    // expect at least one multi-line candidate
    expect(cands.some((c) => c.lines.length >= 2)).toBe(true)
  })

  it('avoids kinsoku violations when nudging breaks', () => {
    const p = createDefaultProject()
    // text crafted so a naive even split would put 。 at a line start
    p.text = 'ねこ。いぬ。とり。うま'
    p.layout.mode = 'jp-balanced'
    const cands = generateCandidates(p)
    // the best (lowest-violation) candidate should have 0 or minimal violations
    const minViolations = Math.min(...cands.map((c) => countKinsokuViolations(c.lines)))
    expect(minViolations).toBe(0)
  })
})

describe('segmentGraphemes', () => {
  it('keeps emoji ZWJ sequences intact', () => {
    // family emoji = multiple codepoints joined by ZWJ
    const family = '👨‍👩‍👧'
    const parts = segmentGraphemes(family)
    expect(parts.length).toBe(1)
  })

  it('keeps combining dakuten with its base where applicable', () => {
    const parts = segmentGraphemes('がぎ')
    expect(parts.length).toBe(2)
  })
})
