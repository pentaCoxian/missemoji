// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { encodeShare, decodeShare } from './share'
import { createDefaultProject } from './defaults'

describe('share codec', () => {
  it('round-trips through the compressed codec', async () => {
    const p = createDefaultProject()
    p.text = 'こんにちは Misskey 🎉'
    p.animation.enabled = true
    p.animation.preset = 'gangan'
    const hash = await encodeShare(p)
    expect(hash.startsWith('p=d.')).toBe(true)
    expect(await decodeShare(`#${hash}`)).toEqual(p)
  })

  it('round-trips through the plain codec', async () => {
    const p = createDefaultProject()
    const hash = await encodeShare(p, { compress: false })
    expect(hash.startsWith('p=j.')).toBe(true)
    expect(await decodeShare(hash)).toEqual(p)
  })

  it('stays compact for a typical project', async () => {
    const hash = await encodeShare(createDefaultProject())
    expect(hash.length).toBeLessThan(700)
  })

  it('returns null for missing or garbage payloads', async () => {
    expect(await decodeShare('')).toBeNull()
    expect(await decodeShare('#other=1')).toBeNull()
    expect(await decodeShare('#p=d.!!!notbase64')).toBeNull()
    expect(await decodeShare('#p=x.abc')).toBeNull()
    expect(await decodeShare('#p=j.bnVsbA')).toBeNull() // "null" is not a project
  })
})
