import { describe, it, expect } from 'vitest'
import { parseBatchLines, BATCH_MAX } from './batch'

describe('parseBatchLines', () => {
  it('splits, trims, drops blanks and caps the count', () => {
    expect(parseBatchLines('  やった！ \n\n\nhello\r\n  \nworld')).toEqual([
      'やった！',
      'hello',
      'world',
    ])
    const many = Array.from({ length: BATCH_MAX + 10 }, (_, i) => `e${i}`).join('\n')
    expect(parseBatchLines(many).length).toBe(BATCH_MAX)
  })
})
