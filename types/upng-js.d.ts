/**
 * Hand-written ambient types for upng-js (no @types package ships with it).
 * upng-js is the day-1 APNG backend (core/export/apng/upngBackend.ts) until
 * the Rust→WASM encoder lands. UPNG.encode premultiplies/quantizes when cnum>0.
 */
declare module 'upng-js' {
  /**
   * @param imgs   array of RGBA frame buffers (ArrayBuffer, length = w*h*4)
   * @param w      width in px
   * @param h      height in px
   * @param cnum   color count; 0 = lossless 32-bit RGBA, >0 = quantized palette
   * @param dels   per-frame delays in ms (length = imgs.length) for APNG
   * @returns      encoded PNG/APNG bytes
   */
  export function encode(
    imgs: ArrayBuffer[],
    w: number,
    h: number,
    cnum: number,
    dels?: number[],
  ): ArrayBuffer

  export interface DecodedImage {
    width: number
    height: number
    depth: number
    ctype: number
    frames: { rect: { x: number; y: number; width: number; height: number }; delay: number }[]
    tabs: Record<string, unknown>
    data: Uint8Array
  }

  export function decode(buffer: ArrayBuffer): DecodedImage
  export function toRGBA8(img: DecodedImage): ArrayBuffer[]

  const UPNG: {
    encode: typeof encode
    decode: typeof decode
    toRGBA8: typeof toRGBA8
  }
  export default UPNG
}
