import { watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useFontsStore } from '~/stores/fonts'
import { useProjectStore } from '~/stores/project'
import { installHistoryTracking } from '~/composables/useHistory'
import { decodeShare } from '#core/project/share'

/**
 * Client-only persistence:
 *  - font favourites / recents in localStorage;
 *  - the project itself: a share link in the URL hash wins (and is stripped so
 *    a reload restores the user's edits, not the link), otherwise the last
 *    autosave. Every load goes through migrateProject (inside loadProject),
 *    so older or hand-edited JSON is upgraded. Autosave is debounced.
 *  - undo / redo tracking starts once the initial project is in place.
 */
const KEY_FONTS = 'missemoji.fonts.v1'
const KEY_PROJECT = 'missemoji.project.v2'

export default defineNuxtPlugin(async (nuxtApp) => {
  const fonts = useFontsStore()
  const projectStore = useProjectStore()

  try {
    const raw = localStorage.getItem(KEY_FONTS)
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
          KEY_FONTS,
          JSON.stringify({ favorites: fonts.favorites, recent: fonts.recent }),
        )
      } catch {
        // storage full / disabled — non-fatal
      }
    },
    { deep: true },
  )

  function stripShareHash() {
    if (location.hash.startsWith('#p=')) {
      history.replaceState(null, '', location.pathname + location.search)
    }
  }

  /** Load a share link from the current hash (and strip it); true when one was applied. */
  async function applyShareHash(): Promise<boolean> {
    const shared = await decodeShare(location.hash)
    if (!shared) return false
    projectStore.loadProject(shared)
    stripShareHash()
    return true
  }

  const restored = await applyShareHash()
  // The router re-applies the initial hash during its first navigation; strip
  // it again once that is over so a reload restores the user's edits.
  if (restored) {
    void useRouter().isReady().then(stripShareHash)
    nuxtApp.hook('app:mounted', stripShareHash)
  }
  // A share link pasted into an already-open tab arrives as a hash change.
  window.addEventListener('hashchange', () => void applyShareHash())

  if (!restored) {
    try {
      const raw = localStorage.getItem(KEY_PROJECT)
      if (raw) projectStore.loadProject(JSON.parse(raw))
    } catch {
      // corrupt autosave — start from defaults
    }
  }

  installHistoryTracking()

  watchDebounced(
    () => projectStore.project,
    () => {
      try {
        localStorage.setItem(KEY_PROJECT, JSON.stringify(projectStore.project))
      } catch {
        // storage full / disabled — non-fatal
      }
    },
    { deep: true, debounce: 500, maxWait: 2000 },
  )
})
