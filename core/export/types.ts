import type { ExportFormat, OptimizeFor } from '../project/schema'
import type { RenderFrame } from '../types'

/**
 * Encoder-agnostic export interface (spec §14). Each format (PNG/APNG/GIF/...)
 * implements EmojiEncoder; the registry maps format -> encoder. Adding a new
 * format = register a new encoder; nothing else changes.
 */

export interface EncodeOptions {
  width: number
  height: number
  loop: boolean
  optimizeFor: OptimizeFor
  /** abort flag checked between frames for cancellation */
  shouldCancel?: () => boolean
  /** progress callback 0..1 */
  onProgress?: (p: number) => void
}

export interface EncodedResult {
  format: ExportFormat
  data: Uint8Array
  bytes: number
  mime: string
}

export interface EmojiEncoder {
  format: ExportFormat
  supportsAnimation: boolean
  encode(frames: RenderFrame[], opts: EncodeOptions): Promise<EncodedResult>
}

/** APNG backend seam — lets us swap upng-js for the Rust→WASM encoder (M9). */
export interface ApngBackend {
  id: string
  encode(
    frames: RenderFrame[],
    opts: { width: number; height: number; loop: boolean; quantizeColors?: number },
  ): Promise<Uint8Array>
}

export class NotImplementedError extends Error {
  constructor(format: string) {
    super(`Encoder for "${format}" is not implemented yet`)
    this.name = 'NotImplementedError'
  }
}
