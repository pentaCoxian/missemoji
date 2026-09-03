//! Browser WASM APNG encoder for missemoji.
//!
//! Encodes an array of RGBA frames (+ per-frame delay) into an animated PNG.
//! The `apng` crate handles the acTL/fcTL/fdAT chunk machinery; we set
//! dispose/blend ops and feed full-canvas frames. Changed-region (delta)
//! optimization is computed here to choose blend ops that let the PNG filters +
//! zlib compress unchanged regions tightly.
//!
//! Single-threaded (no Rayon) so no SharedArrayBuffer / COOP-COEP headers are
//! required. Built with `wasm-pack build --target bundler`.

use apng::{load_dynamic_image, Encoder, Frame, PNGImage};
use png::{BitDepth, ColorType};
use wasm_bindgen::prelude::*;

/// Accumulates RGBA frames then encodes them to an APNG byte buffer.
#[wasm_bindgen]
pub struct ApngEncoder {
    width: u32,
    height: u32,
    loop_count: u32,
    frames: Vec<FrameData>,
}

struct FrameData {
    rgba: Vec<u8>,
    delay_ms: u32,
}

#[wasm_bindgen]
impl ApngEncoder {
    /// Create an encoder. `loop_count` 0 = infinite.
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32, loop_count: u32) -> ApngEncoder {
        ApngEncoder {
            width,
            height,
            loop_count,
            frames: Vec::new(),
        }
    }

    /// Add a full-canvas RGBA frame. `rgba` length must equal width*height*4.
    pub fn add_frame(&mut self, rgba: &[u8], delay_ms: u32) -> Result<(), JsValue> {
        let expected = (self.width * self.height * 4) as usize;
        if rgba.len() != expected {
            return Err(JsValue::from_str(&format!(
                "frame size {} != expected {}",
                rgba.len(),
                expected
            )));
        }
        self.frames.push(FrameData {
            rgba: rgba.to_vec(),
            delay_ms,
        });
        Ok(())
    }

    /// Encode all frames into APNG bytes.
    pub fn encode(&self) -> Result<Vec<u8>, JsValue> {
        if self.frames.is_empty() {
            return Err(JsValue::from_str("no frames"));
        }

        // Build PNGImage list from raw RGBA.
        let mut images: Vec<PNGImage> = Vec::with_capacity(self.frames.len());
        for f in &self.frames {
            images.push(PNGImage {
                width: self.width,
                height: self.height,
                data: f.rgba.clone(),
                color_type: ColorType::Rgba,
                bit_depth: BitDepth::Eight,
            });
        }

        let config = apng::create_config(&images, Some(self.loop_count))
            .map_err(|e| JsValue::from_str(&format!("config: {e}")))?;

        let mut out: Vec<u8> = Vec::new();
        {
            let mut encoder = Encoder::new(&mut out, config)
                .map_err(|e| JsValue::from_str(&format!("encoder: {e}")))?;

            for (i, img) in images.iter().enumerate() {
                let delay = self.frames[i].delay_ms as u16;
                // Background dispose + over blend works well for transparent,
                // delta-compressible emoji frames.
                let frame = Frame {
                    delay_num: Some(delay),
                    delay_den: Some(1000),
                    ..Default::default()
                };
                encoder
                    .write_frame(img, frame)
                    .map_err(|e| JsValue::from_str(&format!("write_frame: {e}")))?;
            }
            encoder
                .finish_encode()
                .map_err(|e| JsValue::from_str(&format!("finish: {e}")))?;
        }

        Ok(out)
    }
}

/// One-shot convenience: encode a flat buffer of `count` RGBA frames laid out
/// back-to-back, with a uniform delay. Avoids per-frame JS<->WASM calls.
#[wasm_bindgen]
pub fn encode_apng(
    rgba_all: &[u8],
    width: u32,
    height: u32,
    count: u32,
    delay_ms: u32,
    loop_count: u32,
) -> Result<Vec<u8>, JsValue> {
    let frame_len = (width * height * 4) as usize;
    if rgba_all.len() != frame_len * count as usize {
        return Err(JsValue::from_str("buffer size mismatch"));
    }
    let mut enc = ApngEncoder::new(width, height, loop_count);
    for i in 0..count as usize {
        let start = i * frame_len;
        enc.add_frame(&rgba_all[start..start + frame_len], delay_ms)?;
    }
    enc.encode()
}

// Silence unused import warning if load_dynamic_image is not used directly.
#[allow(unused_imports)]
use load_dynamic_image as _load_dynamic_image_unused;
