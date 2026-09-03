import { describe, it, expect } from 'vitest'
import { sanitizeName, suggestFilename, uniqueNames } from './filename'

describe('suggestFilename', () => {
  it('keeps Japanese, full-width Latin and Hangul; drops punctuation; apng uses .png', () => {
    expect(suggestFilename('やった！', 'apng')).toBe('やった.png')
    expect(suggestFilename('Ｈｅｌｌｏ 한글', 'gif')).toBe('Ｈｅｌｌｏ_한글.gif')
    expect(suggestFilename('  hi there  ', 'png')).toBe('hi_there.png')
  })

  it('falls back to "emoji" when nothing survives', () => {
    expect(suggestFilename('🎉!!', 'apng')).toBe('emoji.png')
    expect(suggestFilename('', 'gif')).toBe('emoji.gif')
  })

  it('cuts at 24 code points without splitting surrogate pairs', () => {
    const long = '𝔘'.repeat(30) // astral letters (2 UTF-16 units each)
    const stem = sanitizeName(long)
    expect(Array.from(stem).length).toBe(24)
    expect(stem).toBe('𝔘'.repeat(24))
  })
})

describe('uniqueNames', () => {
  it('suffixes duplicates before the extension', () => {
    expect(uniqueNames(['a.png', 'a.png', 'b.png', 'a.png'])).toEqual([
      'a.png',
      'a_2.png',
      'b.png',
      'a_3.png',
    ])
  })

  it('does not collide with an explicit _2', () => {
    expect(uniqueNames(['a.png', 'a_2.png', 'a.png'])).toEqual(['a.png', 'a_2.png', 'a_3.png'])
  })
})
