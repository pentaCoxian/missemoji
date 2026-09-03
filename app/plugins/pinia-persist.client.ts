import { watch } from 'vue'
import { useFontsStore } from '~/stores/fonts'

/**
 * Minimal client-only persistence for font favorites/recent. The full project
 * save/load (JSON) is a later phase; this just keeps the picker friendly across
 * reloads. Runs only on the client (`.client.ts`).
 */
export default defineNuxtPlugin(() => {
  const KEY = 'missemoji.fonts.v1'
  const fonts = useFontsStore()

  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const data = JSON.parse(raw) as { favorites?: string[]; recent?: string[] }
      if (Array.isArray(data.favorites)) fonts.favorites = data.favorites
      if (Array.isArray(data.recent)) fonts.recent = data.recent
    }
  } catch {
    // ignore corrupt storage
  }

  watch(
    () => [fonts.favorites, fonts.recent],
    () => {
      try {
        localStorage.setItem(
          KEY,
          JSON.stringify({ favorites: fonts.favorites, recent: fonts.recent }),
        )
      } catch {
        // storage full / disabled — non-fatal
      }
    },
    { deep: true },
  )
})
