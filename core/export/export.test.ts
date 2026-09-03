import { describe, it, expect, beforeAll } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { setCanvasFactory, createSurface } from '../render/renderContext'
import { renderAllFrames } from '../render/renderAllFrames'
import { solveLayout } from '../layout/solve'
import { getEncoder } from './registry'
import { optimizeFrames } from './optimizeFrames'
import { createDefaultProject } from '../project/defaults'
import type { EmojiProject } from '../project/schema'

/**
 * End-to-end export verification: render → encode → assert valid file bytes.
 * Covers PNG (static), APNG (animated, upng backend), and GIF (gifenc fallback),
 * plus the optimizeFrames dedup pass.
 */
beforeAll(() => {
  setCanvasFactory((w, h) => createCanvas(w, h) as unknown as OffscreenCanvas)
})

function projectWith(overrides: Partial<EmojiProject> = {}): EmojiProject {
  const p = createDefaultProject()
  p.text = 'AB'
  p.font.family = 'sans-serif'
  p.style.strokes = []
  return { ...p, ...overrides }
}

function renderFrames(p: EmojiProject) {
  const measure = createSurface(64, 64)
  const layout = solveLayout(measure.ctx, p)
  return renderAllFrames(p, layout)
}

// PNG magic bytes
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

describe('export encoders (headless)', () => {
  it('PNG encodes valid PNG signature', async () => {
    const p = projectWith()
    const frames = renderFrames(p)
    const res = await getEncoder('png').encode(frames, {
      width: 128,
      height: 128,
      loop: false,
      optimizeFor: 'balanced',
    })
    expect(res.bytes).toBeGreaterThan(50)
    for (let i = 0; i < PNG_SIG.length; i++) {
      expect(res.data[i]).toBe(PNG_SIG[i])
    }
  })

  it('APNG (animated) encodes with PNG signature + acTL chunk', async () => {
    const p = projectWith()
    p.animation.enabled = true
    p.animation.preset = 'pulse'
    p.animation.fps = 8
    p.animation.durationMs = 600
    const frames = renderFrames(p)
    expect(frames.length).toBeGreaterThan(1)

    const res = await getEncoder('apng').encode(frames, {
      width: 128,
      height: 128,
      loop: true,
      optimizeFor: 'balanced',
    })
    expect(res.bytes).toBeGreaterThan(100)
    // PNG signature
    for (let i = 0; i < PNG_SIG.length; i++) expect(res.data[i]).toBe(PNG_SIG[i])
    // acTL animation control chunk must be present for a real APNG
    expect(findChunk(res.data, 'acTL')).toBe(true)
  })

  it('GIF encodes valid GIF89a header', async () => {
    const p = projectWith()
    p.animation.enabled = true
    p.animation.preset = 'bounce'
    p.animation.fps = 6
    p.animation.durationMs = 500
    const frames = renderFrames(p)
    const res = await getEncoder('gif').encode(frames, {
      width: 128,
      height: 128,
      loop: true,
      optimizeFor: 'balanced',
    })
    // "GIF89a"
    const header = String.fromCharCode(...res.data.slice(0, 6))
    expect(header).toBe('GIF89a')
  })

  it('optimizeFrames merges identical consecutive frames', () => {
    const p = projectWith()
    // static project -> single frame; duplicate it to test dedup
    const [frame] = renderFrames(p)
    const dup = { ...frame!, rgba: frame!.rgba.slice() }
    const { frames, duplicatesMerged } = optimizeFrames([
      frame!,
      dup,
      { ...frame!, rgba: frame!.rgba.slice() },
    ])
    expect(duplicatesMerged).toBe(2)
    expect(frames.length).toBe(1)
    // merged delays
    expect(frames[0]!.delayMs).toBe(frame!.delayMs * 3)
  })
})

/** Scan a PNG byte stream for a named chunk type. */
function findChunk(data: Uint8Array, type: string): boolean {
  const target = type.split('').map((c) => c.charCodeAt(0))
  let pos = 8 // after signature
  while (pos + 8 <= data.length) {
    const len = (data[pos]! << 24) | (data[pos + 1]! << 16) | (data[pos + 2]! << 8) | data[pos + 3]!
    const t = [data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]]
    if (t.every((b, i) => b === target[i])) return true
    pos += 12 + len // length(4) + type(4) + data(len) + crc(4)
  }
  return false
}
