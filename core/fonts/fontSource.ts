/**
 * A single @font-face-like record the render worker can load with the
 * FontFace API. Google fonts arrive as gstatic `url`s (CORS-enabled, HTTP
 * cached); user-uploaded fonts carry their bytes in `data`. Exactly one of
 * `url` / `data` is set.
 */
export interface FontFaceSource {
  family: string
  weight: number
  style: 'normal' | 'italic'
  /** CSS unicode-range for subsetted faces (Google JP fonts ship ~100 of them) */
  unicodeRange?: string
  url?: string
  data?: ArrayBuffer
}

/** Identity of a face for caching (family + weight + style + subset). */
export function faceKey(f: FontFaceSource): string {
  return `${f.family}|${f.weight}|${f.style}|${f.unicodeRange ?? '*'}`
}
