import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '~/stores/project'
import { useFontsStore } from '~/stores/fonts'
import { loadGoogleFont } from '#core/fonts/loadFont'
import { getFontDescriptor } from '#core/fonts/catalog'
import { clearMeasureCache } from '#core/layout/measureText'

/**
 * Ensures the project's selected font family is loaded (all of the family's
 * weights, full glyph set), then signals the pipeline to re-solve/re-render
 * (spec §8 step 5). Loading goes through core/fonts/loadFont: the Google CSS is
 * fetched via the same-origin Nitro proxy and turned into FontFace objects,
 * falling back to a `<link>` injection on static hosts. Returns `ensure()` so
 * the preview pipeline can await a font before its first layout.
 */
export function useFontLoading(onFontReady: () => void) {
  const projectStore = useProjectStore()
  const fontsStore = useFontsStore()
  const { project } = storeToRefs(projectStore)

  async function ensure(family = project.value.font.family) {
    const descriptor = getFontDescriptor(family)
    if (!descriptor) return
    if (fontsStore.isLoaded(family)) return

    fontsStore.markLoading(family)
    try {
      // Load the whole family once (all weights) so weight changes need no
      // reload and the full glyph set is available as the user types.
      await loadGoogleFont(descriptor, {
        weights: descriptor.weights,
        text: project.value.text,
      })
      fontsStore.markLoaded(family)
      fontsStore.pushRecent(family)
      // Font metrics changed — clear measurement cache and re-run layout.
      clearMeasureCache()
      onFontReady()
    } catch {
      fontsStore.markFailed(family)
    }
  }

  // Re-load only when the family changes (all weights are loaded up front).
  watch(
    () => project.value.font.family,
    () => {
      void ensure()
    },
  )

  return { ensure }
}
