import { describe, it, expect } from 'vitest'
import { parseColor, shiftHue, toHex, rgbToHsl, hslToRgb } from './color'

describe('color utils', () => {
  it('parses hex and rgb() forms', () => {
    expect(parseColor('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    expect(parseColor('#ff000080')!.a).toBeCloseTo(0.502, 2)
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 })
    expect(parseColor('rgb(1,2,3)')).toEqual({ r: 1, g: 2, b: 3, a: 1 })
    expect(parseColor('tomato')).toBeNull()
  })

  it('round-trips HSL', () => {
    for (const hex of ['#ff5d8f', '#123456', '#ffffff', '#000000', '#7367f0']) {
      const c = parseColor(hex)!
      const { h, s, l } = rgbToHsl(c.r, c.g, c.b)
      expect(toHex({ ...hslToRgb(h, s, l), a: 1 })).toBe(hex)
    }
  })

  it('shiftHue rotates red → green → blue and 360 is the identity', () => {
    expect(shiftHue('#ff0000', 120)).toBe('#00ff00')
    expect(shiftHue('#ff0000', 240)).toBe('#0000ff')
    expect(shiftHue('#ff5d8f', 360)).toBe('#ff5d8f')
    expect(shiftHue('#ff5d8f', -360)).toBe('#ff5d8f')
  })

  it('keeps alpha and leaves greys alone unless a saturation floor is set', () => {
    expect(shiftHue('#ff000080', 120)).toBe('#00ff0080')
    expect(shiftHue('#808080', 90)).toBe('#808080')
    const lifted = shiftHue('#808080', 0, 0.7)
    expect(lifted).not.toBe('#808080')
    // white gets pulled toward mid lightness so it can show colour
    expect(shiftHue('#ffffff', 0, 0.7)).not.toBe('#ffffff')
    expect(shiftHue('not a color', 90)).toBe('not a color')
  })
})
