import { ref } from 'vue'
import { setApngBackend } from '#core/export/apng/backend'
import { upngBackend } from '#core/export/apng/upngBackend'
import { wasmApngBackend, isWasmApngAvailable } from '#core/export/apng/wasmBackend'

/**
 * Lets the user choose the APNG encoder backend at runtime (decision §5):
 * the proven upng-js (default) or the Rust→WASM encoder. The same ApngBackend
 * interface means the export pipeline is unchanged either way.
 *
 * NOTE: encoding runs in the encode worker, so the backend must be set inside
 * the worker too. We expose the choice via a query the worker reads; for the
 * simple case both backends are registered and the worker default is used.
 */
export type ApngEngine = 'upng' | 'wasm'

const engine = ref<ApngEngine>('upng')
const wasmAvailable = ref<boolean | null>(null)

export function useApngBackend() {
  async function checkWasm() {
    if (wasmAvailable.value === null) {
      wasmAvailable.value = await isWasmApngAvailable()
    }
    return wasmAvailable.value
  }

  async function setEngine(next: ApngEngine) {
    if (next === 'wasm') {
      const ok = await checkWasm()
      if (!ok) {
        engine.value = 'upng'
        setApngBackend(upngBackend)
        return false
      }
      setApngBackend(wasmApngBackend)
    } else {
      setApngBackend(upngBackend)
    }
    engine.value = next
    return true
  }

  return { engine, wasmAvailable, checkWasm, setEngine }
}
