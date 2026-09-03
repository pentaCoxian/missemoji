import { describe, it, expect } from 'vitest'
import { buildCss2Url } from './googleFontsCss'
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
