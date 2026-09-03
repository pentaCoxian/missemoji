import { describe, it, expect } from 'vitest'
import { createHistory, commit, undo, redo, HISTORY_MAX } from './history'

describe('history', () => {
  it('commit is a no-op for an identical snapshot', () => {
    const h = createHistory('a')
    expect(commit(h, 'a')).toBeNull()
  })

  it('undo / redo walk the sequence and a new commit clears the future', () => {
    let h = createHistory('a')
    h = commit(h, 'b')!
    h = commit(h, 'c')!
    h = undo(h)!
    expect(h.present).toBe('b')
    expect(h.future).toEqual(['c'])
    h = redo(h)!
    expect(h.present).toBe('c')
    h = undo(h)!
    h = commit(h, 'd')!
    expect(h.present).toBe('d')
    expect(h.future).toEqual([])
    expect(h.past).toEqual(['a', 'b'])
  })

  it('undo / redo on empty stacks return null', () => {
    const h = createHistory('a')
    expect(undo(h)).toBeNull()
    expect(redo(h)).toBeNull()
  })

  it('caps the past at HISTORY_MAX', () => {
    let h = createHistory('0')
    for (let i = 1; i <= HISTORY_MAX + 20; i++) h = commit(h, String(i))!
    expect(h.past.length).toBe(HISTORY_MAX)
    expect(h.past[0]).toBe('20')
  })
})
