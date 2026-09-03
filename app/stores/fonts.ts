import { defineStore } from 'pinia'

/**
 * Font catalog + loading state. The actual curated catalog and loader land in
 * M2 (core/fonts/*). Favorites/recent are persisted; loaded/loading/failed are
 * transient session state.
 */
export const useFontsStore = defineStore('fonts', {
  state: () => ({
    loaded: new Set<string>(),
    loading: new Set<string>(),
    failed: new Set<string>(),
    favorites: [] as string[],
    recent: [] as string[],
    missingGlyphs: {} as Record<string, string[]>,
  }),

  getters: {
    isLoaded: (s) => (family: string) => s.loaded.has(family),
    isLoading: (s) => (family: string) => s.loading.has(family),
  },

  actions: {
    markLoading(family: string) {
      this.loading.add(family)
      this.failed.delete(family)
    },
    markLoaded(family: string) {
      this.loading.delete(family)
      this.loaded.add(family)
    },
    markFailed(family: string) {
      this.loading.delete(family)
      this.failed.add(family)
    },
    toggleFavorite(family: string) {
      const i = this.favorites.indexOf(family)
      if (i >= 0) this.favorites.splice(i, 1)
      else this.favorites.push(family)
    },
    pushRecent(family: string) {
      this.recent = [family, ...this.recent.filter((f) => f !== family)].slice(0, 12)
    },
    setMissingGlyphs(family: string, glyphs: string[]) {
      this.missingGlyphs[family] = glyphs
    },
  },
})
