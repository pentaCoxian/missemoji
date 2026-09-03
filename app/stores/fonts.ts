import { defineStore } from 'pinia'

/** A font the user uploaded this session (kept in memory only, never persisted). */
export interface CustomFontRecord {
  family: string
  weight: number
  style: 'normal' | 'italic'
  data: ArrayBuffer
  fileName: string
  bytes: number
}

/**
 * Font catalog + loading state. Favorites/recent are persisted; loaded /
 * loading / failed and the uploaded fonts are transient session state.
 */
export const useFontsStore = defineStore('fonts', {
  state: () => ({
    loaded: new Set<string>(),
    loading: new Set<string>(),
    failed: new Set<string>(),
    favorites: [] as string[],
    recent: [] as string[],
    customFonts: [] as CustomFontRecord[],
  }),

  getters: {
    isLoaded: (s) => (family: string) => s.loaded.has(family),
    isLoading: (s) => (family: string) => s.loading.has(family),
    isFailed: (s) => (family: string) => s.failed.has(family),
    customFont: (s) => (family: string) => s.customFonts.find((f) => f.family === family),
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
    addCustomFont(rec: CustomFontRecord) {
      this.customFonts = [...this.customFonts.filter((f) => f.family !== rec.family), rec]
      this.loaded.add(rec.family)
    },
    removeCustomFont(family: string) {
      this.customFonts = this.customFonts.filter((f) => f.family !== family)
      this.loaded.delete(family)
    },
  },
})
