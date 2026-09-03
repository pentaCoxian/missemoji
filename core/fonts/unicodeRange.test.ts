import { describe, it, expect } from 'vitest'
import { parseUnicodeRange, selectFacesForText } from './unicodeRange'
import type { FontFaceSource } from './fontSource'

describe('parseUnicodeRange', () => {
  it('parses singles, ranges and wildcards', () => {
    expect(parseUnicodeRange('U+0000-00FF, U+0131, U+0152-0153')).toEqual([
      [0, 0xff],
      [0x131, 0x131],
      [0x152, 0x153],
    ])
    expect(parseUnicodeRange('U+30??')).toEqual([[0x3000, 0x30ff]])
    expect(parseUnicodeRange('garbage, U+ZZ')).toEqual([])
  })
})

describe('selectFacesForText', () => {
  const face = (w: number, unicodeRange?: string, style: 'normal' | 'italic' = 'normal') =>
    ({ family: 'F', weight: w, style, unicodeRange, url: 'x' }) as FontFaceSource
  const faces = [
    face(400),
    face(400, 'U+3040-309F'), // hiragana
    face(400, 'U+4E00-9FFF'), // kanji
    face(700, 'U+3040-309F'),
    face(400, 'U+0000-00FF', 'italic'),
  ]

  it('keeps unranged faces and only the subsets the text touches', () => {
    const out = selectFacesForText(faces, 'やった', { weights: [400] })
    expect(out).toEqual([faces[0], faces[1]])
  })

  it('filters by weight and style', () => {
    expect(selectFacesForText(faces, 'やった', { weights: [700] })).toEqual([faces[3]])
    expect(selectFacesForText(faces, 'abc', { style: 'italic' })).toEqual([faces[4]])
  })

  it('empty text still yields the unranged faces', () => {
    expect(selectFacesForText(faces, '', { weights: [400] })).toEqual([faces[0]])
  })
})
