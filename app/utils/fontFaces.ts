import type { EmojiProject } from '#core/project/schema'
import type { FontFaceSource } from '#core/fonts/fontSource'
import { getFontDescriptor } from '#core/fonts/catalog'
import { getFontFaceSources } from '#core/fonts/loadFont'
import { selectFacesForText } from '#core/fonts/unicodeRange'

export interface CollectedFaces {
  /** faces a render realm must load for this project (subset for the text) */
  faces: FontFaceSource[]
  /** the family is a web font (catalog / custom) rather than a system font */
  needsFaces: boolean
  /** we actually have loadable sources for it */
  hasFaces: boolean
}

/**
 * The font faces a render worker needs for a project: for catalog families the
 * @font-face sources recorded when the main thread loaded them (only the
 * unicode-range subsets the text touches, at the current weight); system
 * families need nothing. Missing sources (the `<link>` fallback path, or the
 * family not loaded yet) mean a worker could not match the preview, so the
 * caller should render on the main thread instead.
 */
export function collectFontFaces(project: EmojiProject): CollectedFaces {
  const family = project.font.family
  if (!getFontDescriptor(family)) return { faces: [], needsFaces: false, hasFaces: true }
  const sources = getFontFaceSources(family)
  if (!sources) return { faces: [], needsFaces: true, hasFaces: false }
  return {
    faces: selectFacesForText(sources, project.text, { weights: [project.font.weight] }),
    needsFaces: true,
    hasFaces: true,
  }
}
