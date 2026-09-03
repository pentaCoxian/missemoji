import type { ApngBackend } from '../types'
import { upngBackend } from './upngBackend'

/**
 * Active APNG backend selector (spec §5, decision: swappable). Defaults to
 * upng-js; the Rust→WASM backend (M9) registers here behind a flag and the rest
 * of the export pipeline is unaffected.
 */
let active: ApngBackend = upngBackend

export function getApngBackend(): ApngBackend {
  return active
}

export function setApngBackend(backend: ApngBackend) {
  active = backend
}
