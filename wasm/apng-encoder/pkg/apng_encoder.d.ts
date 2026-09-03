/* tslint:disable */
/* eslint-disable */

/**
 * Accumulates RGBA frames then encodes them to an APNG byte buffer.
 */
export class ApngEncoder {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Add a full-canvas RGBA frame. `rgba` length must equal width*height*4.
     */
    add_frame(rgba: Uint8Array, delay_ms: number): void;
    /**
     * Encode all frames into APNG bytes.
     */
    encode(): Uint8Array;
    /**
     * Create an encoder. `loop_count` 0 = infinite.
     */
    constructor(width: number, height: number, loop_count: number);
}

/**
 * One-shot convenience: encode a flat buffer of `count` RGBA frames laid out
 * back-to-back, with a uniform delay. Avoids per-frame JS<->WASM calls.
 */
export function encode_apng(rgba_all: Uint8Array, width: number, height: number, count: number, delay_ms: number, loop_count: number): Uint8Array;
