import type { EmojiEncoder, EncodeOptions, EncodedResult } from './types'
import { NotImplementedError } from './types'
import type { RenderFrame } from '../types'

/**
 * Animated WebP encoder seam (spec §14). No mature browser WASM animated-WebP
 * encoder exists in 2026 (research), so this throws for now. The interface is
 * here so a future encoder drops in without touching the rest of the pipeline.
 */
export const webpEncoder: EmojiEncoder = {
  format: 'webp',
  supportsAnimation: true,
  async encode(_frames: RenderFrame[], _opts: EncodeOptions): Promise<EncodedResult> {
    throw new NotImplementedError('webp')
  },
}
