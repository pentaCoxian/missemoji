import { describe, it, expect, beforeAll } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { setCanvasFactory, createSurface } from '../render/renderContext'
import { renderProjectFrame } from '../render/renderProject'
import { solveLayout } from '../layout/solve'
import { createDefaultProject } from '../project/defaults'

/**
 * Verify the frame-spanning, feathered gradient fill actually produces a smooth
 * color variation across the rendered emoji (the user's request).
 */
beforeAll(() => {
  setCanvasFactory((w, h) => createCanvas(w, h) as unknown as OffscreenCanvas)
})

describe('gradient fill (headless render)', () => {
  it('produces distinct colors at opposite ends of the gradient', () => {
    const p = createDefaultProject()
    // big solid block of text so the gradient is sampled across the frame
    p.text = '████'
    p.font.family = 'sans-serif'
    p.style.strokes = []
    p.style.fill = {
      type: 'linear-gradient',
      angle: 0, // left -> right
      stops: [
        { position: 0, color: '#ff0000' },
        { position: 1, color: '#0000ff' },
      ],
    }
    const measure = createSurface(64, 64)
    const layout = solveLayout(measure.ctx, p)
    const frame = renderProjectFrame(p, { layout })

    // Collect opaque pixels with their x, find leftmost vs rightmost colors.
    const w = frame.width
    let leftPixel: [number, number, number] | null = null
    let rightPixel: [number, number, number] | null = null
    let leftX = Infinity
    let rightX = -Infinity
    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        if (frame.rgba[i + 3]! > 200) {
          if (x < leftX) {
            leftX = x
            leftPixel = [frame.rgba[i]!, frame.rgba[i + 1]!, frame.rgba[i + 2]!]
          }
          if (x > rightX) {
            rightX = x
            rightPixel = [frame.rgba[i]!, frame.rgba[i + 1]!, frame.rgba[i + 2]!]
          }
        }
      }
    }

    expect(leftPixel).not.toBeNull()
    expect(rightPixel).not.toBeNull()
    // Left should be more red, right should be more blue.
    expect(leftPixel![0]).toBeGreaterThan(leftPixel![2]) // red > blue on left
    expect(rightPixel![2]).toBeGreaterThan(rightPixel![0]) // blue > red on right
  })
})
