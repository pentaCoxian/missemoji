import type { FontFaceSource } from './fontSource'
import { faceKey } from './fontSource'
import { clearMeasureCache } from '../layout/measureText'

/**
 * FontFace loading for whichever global this code runs in (a worker's
 * `self.fonts`, or the document's). Fonts registered on the main thread are
 * NOT visible to a worker's OffscreenCanvas, so the render worker loads the
 * faces it needs itself from the sources the main thread hands it.
 */

interface FontsGlobal {
  fonts?: FontFaceSet
}

function fontSet(): FontFaceSet | null {
  const g = globalThis as unknown as FontsGlobal & { document?: { fonts?: FontFaceSet } }
  return g.fonts ?? g.document?.fonts ?? null
}

/** True when this realm can register FontFace objects (worker or window). */
export function workerFontsAvailable(): boolean {
  return typeof FontFace !== 'undefined' && fontSet() !== null
}

const loaded = new Set<string>()
const failed = new Set<string>()

export interface EnsureFontsResult {
  loaded: number
  failed: number
  /** true when at least one face was newly registered (measurements changed) */
  changed: boolean
}

/**
 * Register + load every face not already loaded in this realm. Failures are
 * recorded so a broken face is not retried on every frame set.
 */
export async function ensureFontFaces(faces: FontFaceSource[]): Promise<EnsureFontsResult> {
  const set = fontSet()
  if (!set || typeof FontFace === 'undefined') {
    return { loaded: 0, failed: faces.length, changed: false }
  }
  let ok = 0
  let bad = 0
  let changed = false
  await Promise.all(
    faces.map(async (face) => {
      const key = faceKey(face)
      if (loaded.has(key)) {
        ok++
        return
      }
      if (failed.has(key)) {
        bad++
        return
      }
      try {
        const source = face.data ?? `url(${face.url})`
        const ff = new FontFace(face.family, source, {
          weight: String(face.weight),
          style: face.style,
          display: 'swap',
          ...(face.unicodeRange ? { unicodeRange: face.unicodeRange } : {}),
        })
        // add before load: Safari matches faces more reliably that way
        set.add(ff)
        await ff.load()
        loaded.add(key)
        changed = true
        ok++
      } catch {
        failed.add(key)
        bad++
      }
    }),
  )
  await set.ready
  if (changed) clearMeasureCache()
  return { loaded: ok, failed: bad, changed }
}
