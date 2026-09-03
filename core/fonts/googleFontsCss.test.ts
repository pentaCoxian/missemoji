import { describe, it, expect } from 'vitest'
import { buildCss2Url, parseFontFaces } from './googleFontsCss'
import { getFontDescriptor } from './catalog'

describe('buildCss2Url', () => {
  const mochiy = getFontDescriptor('Mochiy Pop One')!

  it('builds a keyless CSS2 url with the family and weight', () => {
    const url = buildCss2Url(mochiy, { weights: [400] })
    expect(url).toContain('https://fonts.googleapis.com/css2?')
    expect(url).toContain('family=Mochiy+Pop+One:wght@400')
    expect(url).not.toContain('key=')
  })

  it('subsets with text= when provided', () => {
    const url = buildCss2Url(mochiy, { weights: [400], text: 'やった' })
    expect(url).toContain('text=')
    expect(url).toContain(encodeURIComponent('やった'))
  })

  it('includes display=swap', () => {
    expect(buildCss2Url(mochiy)).toContain('display=swap')
  })

  it('sorts multiple weights ascending', () => {
    const zen = getFontDescriptor('Zen Maru Gothic')!
    const url = buildCss2Url(zen, { weights: [700, 400, 900] })
    expect(url).toContain('wght@400;700;900')
  })
})

describe('parseFontFaces', () => {
  const css = `
/* [1] */
@font-face {
  font-family: 'Kosugi Maru';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/a.woff2) format('woff2');
  unicode-range: U+3040-309F, U+30A0-30FF;
}
@font-face {
  font-family: 'Kosugi Maru';
  font-style: italic;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/s/b.ttf) format('truetype'), url("https://fonts.gstatic.com/s/b.woff2") format('woff2');
}
`
  it('extracts weight, style, the woff2 url and the unicode-range', () => {
    const faces = parseFontFaces(css)
    expect(faces).toEqual([
      {
        weight: 400,
        style: 'normal',
        src: 'https://fonts.gstatic.com/s/a.woff2',
        unicodeRange: 'U+3040-309F, U+30A0-30FF',
      },
      {
        weight: 700,
        style: 'italic',
        src: 'https://fonts.gstatic.com/s/b.woff2',
        unicodeRange: undefined,
      },
    ])
  })
})
