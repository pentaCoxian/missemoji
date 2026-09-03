/**
 * Hand-written ambient types for gifenc (no @types package ships). Covers the
 * subset used by core/export/encodeGif.ts. API per the gifenc README.
 */
declare module 'gifenc' {
  export type GifFormat = 'rgb565' | 'rgb444' | 'rgba4444'

  export interface WriteFrameOpts {
    palette?: number[][]
    /** delay in ms */
    delay?: number
    /** repeat: 0 = forever, -1 = no repeat */
    repeat?: number
    transparent?: boolean
    transparentIndex?: number
    /** disposal method */
    dispose?: number
    first?: boolean
  }

  export interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array | number[],
      width: number,
      height: number,
      opts?: WriteFrameOpts,
    ): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
    reset(): void
  }

  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): GIFEncoderInstance

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: GifFormat; oneBitAlpha?: boolean | number; clearAlpha?: boolean; clearAlphaThreshold?: number; clearAlphaColor?: number },
  ): number[][]

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: GifFormat,
  ): Uint8Array
}
