/**
 * Separable box blur over an RGBA ImageData, used as a fallback when
 * `ctx.filter = blur()` is unavailable (some OffscreenCanvas workers). Three
 * passes approximate a Gaussian. radius is in pixels.
 */
export function boxBlurRGBA(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): void {
  if (radius < 1) return
  const r = Math.round(radius)
  const tmp = new Uint8ClampedArray(data.length)
  for (let pass = 0; pass < 3; pass++) {
    boxBlurH(data, tmp, width, height, r)
    boxBlurV(tmp, data, width, height, r)
  }
}

function boxBlurH(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  width: number,
  height: number,
  r: number,
) {
  const div = r * 2 + 1
  for (let y = 0; y < height; y++) {
    const row = y * width * 4
    for (let ch = 0; ch < 4; ch++) {
      let sum = 0
      // prime the window
      for (let i = -r; i <= r; i++) {
        const x = Math.min(width - 1, Math.max(0, i))
        sum += src[row + x * 4 + ch]!
      }
      for (let x = 0; x < width; x++) {
        dst[row + x * 4 + ch] = sum / div
        const addX = Math.min(width - 1, x + r + 1)
        const subX = Math.max(0, x - r)
        sum += src[row + addX * 4 + ch]! - src[row + subX * 4 + ch]!
      }
    }
  }
}

function boxBlurV(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  width: number,
  height: number,
  r: number,
) {
  const div = r * 2 + 1
  for (let x = 0; x < width; x++) {
    const col = x * 4
    for (let ch = 0; ch < 4; ch++) {
      let sum = 0
      for (let i = -r; i <= r; i++) {
        const y = Math.min(height - 1, Math.max(0, i))
        sum += src[y * width * 4 + col + ch]!
      }
      for (let y = 0; y < height; y++) {
        dst[y * width * 4 + col + ch] = sum / div
        const addY = Math.min(height - 1, y + r + 1)
        const subY = Math.max(0, y - r)
        sum += src[addY * width * 4 + col + ch]! - src[subY * width * 4 + col + ch]!
      }
    }
  }
}
