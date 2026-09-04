import { describe, it, expect } from 'vitest'
import { parseGoogleFontUrl, describeFontUrlError } from './parseFontUrl'

function ok(input: string) {
  const r = parseGoogleFontUrl(input)
  if (!r.ok) throw new Error(`expected success, got ${r.error}`)
  return r.requests
}

describe('parseGoogleFontUrl', () => {
  it('reads a plain CSS2 share URL', () => {
    expect(ok('https://fonts.googleapis.com/css2?family=Rampart+One&display=swap')).toEqual([
      { family: 'Rampart One', weights: [], italic: false },
    ])
  })

  it('reads weights from the wght axis', () => {
    expect(ok('https://fonts.googleapis.com/css2?family=Inter:wght@400;700')).toEqual([
      { family: 'Inter', weights: [400, 700], italic: false },
    ])
  })

  it('reads italics and weights from an ital,wght axis', () => {
    expect(ok('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;1,700')).toEqual([
      { family: 'Inter', weights: [400, 700], italic: true },
    ])
  })

  it('expands a variable weight range to the standard weights it covers', () => {
    expect(ok('https://fonts.googleapis.com/css2?family=Roboto:wght@100..900')[0]!.weights).toEqual(
      [100, 200, 300, 400, 500, 600, 700, 800, 900],
    )
    // a narrower range only offers what it actually covers, endpoints included
    expect(ok('https://fonts.googleapis.com/css2?family=Roboto:wght@350..600')[0]!.weights).toEqual(
      [350, 400, 500, 600],
    )
  })

  it('reads a share URL from the Share button', () => {
    expect(ok('https://fonts.google.com/share?selection.family=M+PLUS+U:wght@100..900')).toEqual([
      {
        family: 'M PLUS U',
        weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
        italic: false,
      },
    ])
  })

  it('reads a share URL with several families and italics', () => {
    const out = ok(
      'https://fonts.google.com/share?selection.family=Inter:wght@400;700|Roboto:ital,wght@0,400;1,700',
    )
    expect(out).toEqual([
      { family: 'Inter', weights: [400, 700], italic: false },
      { family: 'Roboto', weights: [400, 700], italic: true },
    ])
  })

  it('reads a share URL for a family with no axis', () => {
    expect(ok('https://fonts.google.com/share?selection.family=Rampart+One')[0]).toEqual({
      family: 'Rampart One',
      weights: [],
      italic: false,
    })
  })

  it('returns every family in a multi-family URL', () => {
    const out = ok('https://fonts.googleapis.com/css2?family=Inter:wght@400&family=Noto+Sans+JP')
    expect(out.map((r) => r.family)).toEqual(['Inter', 'Noto Sans JP'])
  })

  it('reads a specimen page URL', () => {
    expect(ok('https://fonts.google.com/specimen/Rampart+One')).toEqual([
      { family: 'Rampart One', weights: [], italic: false },
    ])
    expect(ok('https://fonts.google.com/specimen/Mochiy+Pop+One?query=pop')[0]!.family).toBe(
      'Mochiy Pop One',
    )
  })

  it('tolerates a pasted <link> tag or @import snippet', () => {
    expect(
      ok('<link href="https://fonts.googleapis.com/css2?family=Bungee" rel="stylesheet">')[0]!
        .family,
    ).toBe('Bungee')
    expect(ok("@import url('https://fonts.googleapis.com/css2?family=Anton');")[0]!.family).toBe(
      'Anton',
    )
  })

  it('decodes percent-encoded family names', () => {
    expect(ok('https://fonts.googleapis.com/css2?family=Zen%20Maru%20Gothic')[0]!.family).toBe(
      'Zen Maru Gothic',
    )
  })

  it('rejects anything that is not a Google Fonts URL', () => {
    for (const bad of ['', '   ', 'hello', 'https://example.com/font.woff2']) {
      expect(parseGoogleFontUrl(bad).ok).toBe(false)
    }
    const r = parseGoogleFontUrl('https://example.com/x')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(describeFontUrlError(r.error)).toMatch(/Google Fonts/)
  })

  it('rejects a Google Fonts URL with no family', () => {
    const r = parseGoogleFontUrl('https://fonts.googleapis.com/css2?display=swap')
    expect(r).toEqual({ ok: false, error: 'no-family' })
    const s = parseGoogleFontUrl('https://fonts.google.com/about')
    expect(s).toEqual({ ok: false, error: 'unsupported' })
  })
})
