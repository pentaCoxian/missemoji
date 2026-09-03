import { describe, it, expect } from 'vitest'
import { createDefaultProject } from './defaults'
import { classifyChange } from './dirty'

function clone() {
  return createDefaultProject()
}

describe('classifyChange', () => {
  it('reports nothing for an identical project', () => {
    const a = clone()
    const b = clone()
    expect(classifyChange(a, b)).toEqual({
      layout: false,
      render: false,
      frames: false,
      encode: false,
    })
  })

  it('text change triggers full recompute', () => {
    const a = clone()
    const b = clone()
    b.text = 'changed'
    const f = classifyChange(a, b)
    expect(f).toEqual({ layout: true, render: true, frames: true, encode: true })
  })

  it('fill color change is render-only (no layout)', () => {
    const a = clone()
    const b = clone()
    b.style.fill = { type: 'solid', color: '#000000' }
    const f = classifyChange(a, b)
    expect(f.layout).toBe(false)
    expect(f.render).toBe(true)
    expect(f.encode).toBe(true)
  })

  it('stroke width change escalates to layout (safe box changed)', () => {
    const a = clone()
    const b = clone()
    b.style.strokes = [{ width: 20, color: '#ffffff' }]
    const f = classifyChange(a, b)
    expect(f.layout).toBe(true)
    expect(f.render).toBe(true)
  })

  it('export format change is encode-only', () => {
    const a = clone()
    const b = clone()
    b.export.format = 'gif'
    expect(classifyChange(a, b)).toEqual({
      layout: false,
      render: false,
      frames: false,
      encode: true,
    })
  })

  it('animation preset change re-samples frames + encode only', () => {
    const a = clone()
    const b = clone()
    b.animation.preset = 'bounce'
    const f = classifyChange(a, b)
    expect(f).toEqual({ layout: false, render: false, frames: true, encode: true })
  })

  it('render scale change re-renders but not re-layout', () => {
    const a = clone()
    const b = clone()
    b.export.renderScale = 8
    const f = classifyChange(a, b)
    expect(f.layout).toBe(false)
    expect(f.render).toBe(true)
    expect(f.frames).toBe(true)
    expect(f.encode).toBe(true)
  })
})
