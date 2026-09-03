import type { EmojiEncoder, EncodeOptions, EncodedResult } from './types'
import { NotImplementedError } from './types'
import type { RenderFrame } from '../types'

/**
 * ZIP batch-export seam (spec §14, §20 Phase 5). Not implemented in the
 * Phase 1-3 deliverable; the interface exists so batch export drops in later.
 */
export const zipEncoder: EmojiEncoder = {
  format: 'zip',
  supportsAnimation: false,
  async encode(_frames: RenderFrame[], _opts: EncodeOptions): Promise<EncodedResult> {
    throw new NotImplementedError('zip')
  },
}
