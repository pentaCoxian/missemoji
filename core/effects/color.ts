/**
 * Small colour utilities shared by the fill / gradient effects and the rainbow
 * animation. Pure math — safe in workers (no ctx.filter / CSS parsing).
 */

export interface RGBA {
  r: number
  g: number
  b: number
  /** 0..1 */
  a: number
}

/** Parse #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(), rgba(). Null when unrecognised. */
export function parseColor(color: string): RGBA | null {
  const s = color.trim()
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i.exec(s)
  if (short) {
    return {
      r: parseInt(short[1]! + short[1]!, 16),
      g: parseInt(short[2]! + short[2]!, 16),
      b: parseInt(short[3]! + short[3]!, 16),
      a: short[4] ? parseInt(short[4] + short[4], 16) / 255 : 1,
    }
  }
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i.exec(s)
  if (long) {
    return {
      r: parseInt(long[1]!, 16),
      g: parseInt(long[2]!, 16),
      b: parseInt(long[3]!, 16),
      a: long[4] ? parseInt(long[4], 16) / 255 : 1,
    }
  }
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s)
  if (fn) {
    return {
      r: Math.round(Number(fn[1])),
      g: Math.round(Number(fn[2])),
      b: Math.round(Number(fn[3])),
      a: fn[4] !== undefined ? Math.min(1, Math.max(0, Number(fn[4]))) : 1,
    }
  }
  return null
}

/** #rrggbb, plus aa when not fully opaque — a form the rest of the code parses. */
export function toHex(c: RGBA): string {
  const h = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0')
  const base = `#${h(c.r)}${h(c.g)}${h(c.b)}`
  return c.a >= 1 ? base : `${base}${h(c.a * 255)}`
}

/** Linear sRGB mix (alpha too); returned as rgba() for canvas. */
export function mixColor(a: RGBA, b: RGBA, t: number): string {
  const r = Math.round(a.r + (b.r - a.r) * t)
  const g = Math.round(a.g + (b.g - a.g) * t)
  const bl = Math.round(a.b + (b.b - a.b) * t)
  const al = a.a + (b.a - a.a) * t
  return `rgba(${r},${g},${bl},${al.toFixed(3)})`
}

export interface HSL {
  /** degrees 0..360 */
  h: number
  s: number
  l: number
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return { h: h * 60, s, l }
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hn = (((h % 360) + 360) % 360) / 360
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t0: number) => {
    let t = t0
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return {
    r: Math.round(channel(hn + 1 / 3) * 255),
    g: Math.round(channel(hn) * 255),
    b: Math.round(channel(hn - 1 / 3) * 255),
  }
}

/**
 * Rotate a colour's hue by `deg`, keeping alpha. `minSat` (0..1) lifts the
 * saturation floor and pulls extreme lightness toward the middle so that even
 * white / grey / black fills visibly cycle (used by the rainbow preset).
 * Unparseable colours are returned unchanged.
 */
export function shiftHue(color: string, deg: number, minSat = 0): string {
  const c = parseColor(color)
  if (!c) return color
  const { h, s, l } = rgbToHsl(c.r, c.g, c.b)
  let s2 = s
  let l2 = l
  if (minSat > 0) {
    s2 = Math.max(s, minSat)
    if (l > 0.85 || l < 0.15) l2 = l + (0.5 - l) * minSat
  }
  const rgb = hslToRgb(h + deg, s2, l2)
  return toHex({ ...rgb, a: c.a })
}
