import { describe, it, expect, beforeAll } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { setCanvasFactory, createSurface } from './renderContext'
import { renderFrameSequence } from './renderFrameSequence'
import { solveLayout } from '../layout/solve'
import { createDefaultProject } from '../project/defaults'

beforeAll(() => {
  setCanvasFactory((w, h) => createCanvas(w, h) as unknown as OffscreenCanvas)
})

function animated() {
  const p = createDefaultProject()
  p.text = 'AB'
  p.font.family = 'sans-serif'
  p.animation.enabled = true
  p.animation.preset = 'pulse'
  p.animation.fps = 6
  p.animation.durationMs = 500
  return p
}

describe('renderFrameSequence', () => {
  it('yields every planned frame with stats and calls the yield hook between frames', async () => {
    const p = animated()
    const layout = solveLayout(createSurface(64, 64).ctx, p)
    let yields = 0
    const items = []
    for await (const item of renderFrameSequence(p, layout, {
      yieldFn: async () => {
        yields++
      },
    })) {
      items.push(item)
    }
    expect(items.length).toBe(3)
    expect(yields).toBe(2)
    items.forEach((it, i) => {
      expect(it.index).toBe(i)
      expect(it.total).toBe(3)
      expect(it.stats.opaquePixels).toBeGreaterThan(0)
      expect(it.frame.delayMs).toBeGreaterThan(0)
    })
  })

  it('stops with a cancelled error when asked', async () => {
    const p = animated()
    const layout = solveLayout(createSurface(64, 64).ctx, p)
    let seen = 0
    await expect(async () => {
      for await (const _ of renderFrameSequence(p, layout, { shouldCancel: () => seen >= 1 })) {
        seen++
      }
    }).rejects.toThrow('cancelled')
    expect(seen).toBe(1)
  })
})
