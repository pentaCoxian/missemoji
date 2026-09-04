import { describe, it, expect, beforeAll } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { setCanvasFactory, createSurface } from './renderContext'
import { placeText, paintPlacedText, withBlockStretch } from './renderTextLayer'
import { solveLayout } from '../layout/solve'
import { getAlphaBounds } from '../layout/pixelBounds'
import { createDefaultProject } from '../project/defaults'
import type { EmojiProject } from '../project/schema'

/**
 * Vertical alignment must centre the text's REAL ink, not a stack of nominal
 * line boxes. Two bugs used to break this:
 *
 *  - the block was centred as `lineCount * lineGap`, which reserves a whole
 *    line gap below the last baseline while the glyphs only reach their
 *    descent, pushing text upward (worse with a tall line height);
 *  - a measured descent of exactly 0 (text with no descenders, e.g. "ABC") was
 *    treated as missing by a `||` fallback and replaced with a fabricated
 *    0.2em, shifting the block up by tens of pixels.
 *
 * These assert on the glyph fill alone: outline and shadow deliberately add
 * asymmetric ink (a drop shadow is offset downward by design) and centring the
 * letters rather than the shadow is the intended behaviour.
 */
beforeAll(() => setCanvasFactory((w, h) => createCanvas(w, h) as unknown as OffscreenCanvas))

/** Top and bottom gaps around the glyph fill, in final px. */
function inkGaps(mutate: (p: EmojiProject) => void = () => {}) {
  const project = createDefaultProject()
  project.style.strokes = []
  project.style.shadows = []
  project.style.glows = []
  mutate(project)

  const w = project.export.finalWidth
  const h = project.export.finalHeight
  const layout = solveLayout(createSurface(64, 64).ctx, project)
  const surface = createSurface(w, h)
  surface.ctx.clearRect(0, 0, w, h)
  const box = { x: 0, y: 0, w, h }
  const placement = placeText(surface.ctx, project.font, project.layout, layout, 1, box)
  surface.ctx.fillStyle = '#ffffff'
  withBlockStretch(surface.ctx, placement, box, () =>
    paintPlacedText(surface.ctx, project.font, placement, 'fill'),
  )
  const bounds = getAlphaBounds(surface.ctx.getImageData(0, 0, w, h).data, w, h, 8)
  return { top: bounds.minY, bottom: h - bounds.maxY, height: h }
}

describe('vertical alignment centres the real ink', () => {
  const cases: [string, (p: EmojiProject) => void][] = [
    ['the shipped default', () => {}],
    ['a single line', (p) => (p.text = '金')],
    ['three lines', (p) => (p.text = '沈黙\nは\n金')],
    ['a tall line height', (p) => (p.font.lineHeight = 1.4)],
    ['a tight line height', (p) => (p.font.lineHeight = 0.85)],
    // no descenders: the case the `|| fallback` used to break
    ['latin without descenders', (p) => ((p.text = 'ABC'), (p.font.family = 'sans-serif'))],
    ['latin with a descender', (p) => ((p.text = 'Ag'), (p.font.family = 'sans-serif'))],
    [
      'latin under heavy stretch',
      (p) => {
        p.text = 'ABC'
        p.font.family = 'sans-serif'
        p.layout.mode = 'fill'
      },
    ],
  ]

  for (const [label, mutate] of cases) {
    it(`${label}: top and bottom gaps match`, () => {
      const { top, bottom, height } = inkGaps(mutate)
      // within 3% of the canvas: antialiasing and the fitter's tolerance make
      // exact equality unrealistic, but the old bug was 20-50% off
      const tolerance = Math.ceil(height * 0.03)
      expect(Math.abs(top - bottom)).toBeLessThanOrEqual(tolerance)
    })
  }

  it('top alignment hugs the top, bottom alignment hugs the bottom', () => {
    const middle = inkGaps()
    const top = inkGaps((p) => (p.layout.verticalAlign = 'top'))
    const bottom = inkGaps((p) => (p.layout.verticalAlign = 'bottom'))
    expect(top.top).toBeLessThan(middle.top)
    expect(bottom.bottom).toBeLessThan(middle.bottom)
    // and they are mirror images of each other
    expect(Math.abs(top.top - bottom.bottom)).toBeLessThanOrEqual(2)
  })

  it('a descent of zero is kept, not replaced by a fabricated fallback', () => {
    // "ABC" has zero descent. If that were treated as "missing" and replaced
    // with 0.2em, the block would be centred as if it hung below the baseline
    // and the text would ride high — the symptom this test guards. The two
    // strings fit at different sizes, so compare each one's OWN balance.
    const abc = inkGaps((p) => ((p.text = 'ABC'), (p.font.family = 'sans-serif')))
    const ag = inkGaps((p) => ((p.text = 'Ag'), (p.font.family = 'sans-serif')))
    for (const { top, bottom, height } of [abc, ag]) {
      expect(Math.abs(top - bottom)).toBeLessThanOrEqual(Math.ceil(height * 0.03))
    }
  })
})
