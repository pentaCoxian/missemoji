import { describe, it, expect } from 'vitest'
import { unzipSync } from 'fflate'
import { zipFiles } from './encodeZip'

describe('zipFiles', () => {
  it('stores every entry under its name and round-trips the bytes', () => {
    const entries = [
      { name: 'a.png', data: new Uint8Array([1, 2, 3]) },
      { name: 'b.gif', data: new Uint8Array([4, 5]) },
      { name: 'やった.png', data: new Uint8Array([6]) },
    ]
    const zip = zipFiles(entries)
    expect(zip[0]).toBe(0x50) // 'P'
    expect(zip[1]).toBe(0x4b) // 'K'
    const back = unzipSync(zip)
    expect(Object.keys(back).sort()).toEqual(['a.png', 'b.gif', 'やった.png'])
    expect(Array.from(back['a.png']!)).toEqual([1, 2, 3])
    expect(Array.from(back['やった.png']!)).toEqual([6])
  })
})
