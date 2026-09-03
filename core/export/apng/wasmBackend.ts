import type { ApngBackend } from '../types'
import type { RenderFrame } from '../../types'

/**
 * Rust→WASM APNG backend (spec §5, decision: build our own). Mirrors the
 * upng-js backend's interface so it can be swapped via setApngBackend().
 *
 * The wasm-pack output lives at wasm/apng-encoder/pkg and is loaded lazily so
 * the app still boots if it is missing (the encode worker falls back to upng).
 * Frames are pushed one at a time through the exported `ApngEncoder` class so
 * every frame keeps its own delay (optimizeFrames merges duplicates into
 * longer, non-uniform delays).
 */

interface WasmApngEncoder {
  add_frame(rgba: Uint8Array, delayMs: number): void
  encode(): Uint8Array
  free(): void
}

export interface WasmModule {
  default?: (input?: unknown) => Promise<unknown>
  ApngEncoder: new (width: number, height: number, loopCount: number) => WasmApngEncoder
}

type Loader = () => Promise<WasmModule>

const defaultLoader: Loader = async () => {
  // bundler-target wasm-pack output instantiates on import (vite-plugin-wasm);
  // web-target builds expose an async `default()` initializer instead.
  const mod =
    (await import('../../../wasm/apng-encoder/pkg/apng_encoder.js')) as unknown as WasmModule
  if (typeof mod.default === 'function') await mod.default()
  return mod
}

let loader: Loader = defaultLoader
let wasm: WasmModule | null = null
let initPromise: Promise<WasmModule> | null = null

/** Test / environment hook: swap how the wasm module is obtained. */
export function setWasmModuleLoader(fn: Loader | null) {
  loader = fn ?? defaultLoader
  wasm = null
  initPromise = null
}

async function loadWasm(): Promise<WasmModule> {
  if (wasm) return wasm
  if (!initPromise) {
    initPromise = loader()
      .then((mod) => {
        wasm = mod
        return mod
      })
      .catch((err) => {
        // don't poison the backend forever on a transient failure
        initPromise = null
        throw err
      })
  }
  return initPromise
}

export const wasmApngBackend: ApngBackend = {
  id: 'wasm',
  async encode(frames: RenderFrame[], opts): Promise<Uint8Array> {
    if (frames.length === 0) throw new Error('No frames to encode')
    const mod = await loadWasm()
    const enc = new mod.ApngEncoder(opts.width, opts.height, opts.loop ? 0 : 1)
    try {
      for (const f of frames) {
        const rgba = new Uint8Array(f.rgba.buffer, f.rgba.byteOffset, f.rgba.byteLength)
        // fcTL delay_num is a u16 (over a 1000 denominator)
        enc.add_frame(rgba, Math.min(65535, Math.max(0, Math.round(f.delayMs))))
      }
      return enc.encode()
    } finally {
      enc.free()
    }
  },
}

/** Check whether the wasm pkg can be loaded in this environment. */
export async function isWasmApngAvailable(): Promise<boolean> {
  try {
    await loadWasm()
    return true
  } catch {
    return false
  }
}
