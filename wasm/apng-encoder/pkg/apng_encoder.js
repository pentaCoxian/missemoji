/* @ts-self-types="./apng_encoder.d.ts" */
import * as wasm from "./apng_encoder_bg.wasm";
import { __wbg_set_wasm } from "./apng_encoder_bg.js";

__wbg_set_wasm(wasm);

export {
    ApngEncoder, encode_apng
} from "./apng_encoder_bg.js";
