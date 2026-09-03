import type { ExportFormat } from '../project/schema'
import type { EmojiEncoder } from './types'
import { pngEncoder } from './encodePng'
import { apngEncoder } from './encodeApng'
import { gifEncoder } from './encodeGif'
import { webpEncoder } from './encodeWebp'
import { zipEncoder } from './encodeZip'

/**
 * Format -> encoder lookup (spec §14). The export pipeline calls
 * registry.get(format).encode(...). Registering a new format is the only change
 * needed to support it.
 */
const REGISTRY: Record<ExportFormat, EmojiEncoder> = {
  png: pngEncoder,
  apng: apngEncoder,
  gif: gifEncoder,
  webp: webpEncoder,
  zip: zipEncoder,
}

export function getEncoder(format: ExportFormat): EmojiEncoder {
  return REGISTRY[format]
}

export function encoderSupportsAnimation(format: ExportFormat): boolean {
  return REGISTRY[format].supportsAnimation
}
