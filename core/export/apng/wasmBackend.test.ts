// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  wasmApngBackend,
  setWasmModuleLoader,
  isWasmApngAvailable,
  type WasmModule,
} from './wasmBackend'
import type { RenderFrame } from '../../types'

// The node-target build (wasm-pack --target nodejs) is a local, gitignored
// artefact; the round-trip test only runs when it is present.
const NODE_PKG = fileURLToPath(
  new URL('../../../wasm/apng-encoder/pkg-node/apng_encoder.js', import.meta.url),
)
const hasNodePkg = existsSync(NODE_PKG)

function frame(fill: number, delayMs: number): RenderFrame {
  const rgba = new Uint8ClampedArray(4 * 4 * 4)
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = fill
    rgba[i + 3] = 255
  }
  return { rgba, width: 4, height: 4, delayMs }
}

/** Collect fcTL delay numerators from an APNG byte stream. */
function fctlDelays(png: Uint8Array): number[] {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const out: number[] = []
  let off = 8
  while (off + 12 <= png.length) {
    const len = dv.getUint32(off)
    const type = String.fromCharCode(png[off + 4]!, png[off + 5]!, png[off + 6]!, png[off + 7]!)
    if (type === 'fcTL') {
      const num = dv.getUint16(off + 8 + 20)
      const den = dv.getUint16(off + 8 + 22)
      out.push(Math.round((num * 1000) / den))
    }
    off += 12 + len
  }
  return out
}

describe('wasm APNG backend', () => {
  beforeAll(() => {
    setWasmModuleLoader(async () => {
      const m = (await import(/* @vite-ignore */ NODE_PKG)) as WasmModule & { default?: WasmModule }
      return (m.ApngEncoder ? m : m.default) as WasmModule
    })
  })
  afterAll(() => setWasmModuleLoader(null))

  it.skipIf(!hasNodePkg)('keeps every frame delay (non-uniform after dedup)', async () => {
    const png = await wasmApngBackend.encode([frame(10, 100), frame(20, 300), frame(30, 50)], {
      width: 4,
      height: 4,
      loop: true,
    })
    expect(fctlDelays(png)).toEqual([100, 300, 50])
  })

  it('reports unavailability and recovers after a failing loader', async () => {
    setWasmModuleLoader(async () => {
      throw new Error('nope')
    })
    expect(await isWasmApngAvailable()).toBe(false)
    let calls = 0
    setWasmModuleLoader(async () => {
      calls++
      throw new Error('still no')
    })
    expect(await isWasmApngAvailable()).toBe(false)
    expect(await isWasmApngAvailable()).toBe(false)
    // a failed load is retried (initPromise is not poisoned)
    expect(calls).toBe(2)
  })
})
