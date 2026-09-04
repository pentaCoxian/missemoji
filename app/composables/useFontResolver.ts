import { useFontsStore } from '~/stores/fonts'
import { getFontDescriptor, makeDescriptor, type FontDescriptor } from '#core/fonts/catalog'

/** Where a family came from, which decides how it loads and what UI it gets. */
export type FontOrigin = 'catalog' | 'added' | 'uploaded' | 'unknown'

export interface ResolvedFont {
  origin: FontOrigin
  /** null for an uploaded file (its faces come from bytes, not from Google) */
  descriptor: FontDescriptor | null
  /** weights the user can choose from */
  weights: number[]
  italic: boolean
}

/**
 * Resolve a family name to everything the app needs to know about it: the
 * curated catalog, a font added by pasting a Google Fonts link, or a font
 * uploaded from disk. Keeps the picker, the weight control and the loader
 * from each re-deriving this.
 */
export function useFontResolver() {
  const fontsStore = useFontsStore()

  function resolve(family: string): ResolvedFont {
    const catalog = getFontDescriptor(family)
    if (catalog) {
      return {
        origin: 'catalog',
        descriptor: catalog,
        weights: catalog.weights,
        italic: !!catalog.italic,
      }
    }

    const added = fontsStore.addedFont(family)
    if (added) {
      const descriptor = makeDescriptor(family, { weights: added.weights, italic: added.italic })
      return { origin: 'added', descriptor, weights: descriptor.weights, italic: added.italic }
    }

    const uploaded = fontsStore.customFont(family)
    if (uploaded) {
      return { origin: 'uploaded', descriptor: null, weights: [uploaded.weight], italic: false }
    }

    return { origin: 'unknown', descriptor: null, weights: [400], italic: false }
  }

  return { resolve }
}
