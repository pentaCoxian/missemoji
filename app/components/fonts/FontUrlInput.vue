<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '~/stores/project'
import { useFontsStore } from '~/stores/fonts'
import { parseGoogleFontUrl, describeFontUrlError } from '#core/fonts/parseFontUrl'
import { getFontDescriptor } from '#core/fonts/catalog'

/**
 * Add any Google font by pasting a link — either the CSS2 snippet URL or the
 * font's specimen page. Weights and italics named in the link are kept, so
 * `…:wght@400;700` gives you both weights in the weight control.
 */
const store = useProjectStore()
const fontsStore = useFontsStore()

const value = ref('')
const error = ref<string | null>(null)
const added = ref<string | null>(null)

function submit() {
  error.value = null
  added.value = null
  const result = parseGoogleFontUrl(value.value)
  if (!result.ok) {
    error.value = describeFontUrlError(result.error)
    return
  }

  // A multi-family link adds them all; the first becomes the active font.
  for (const req of result.requests) {
    if (!getFontDescriptor(req.family)) {
      fontsStore.addAddedFont({
        family: req.family,
        weights: req.weights,
        italic: req.italic,
      })
    }
  }
  const first = result.requests[0]!
  store.setFontFamily(first.family)
  if (first.weights.length) store.setFontWeight(first.weights[0]!)
  added.value = result.requests.map((r) => r.family).join(', ')
  value.value = ''
}
</script>

<template>
  <div class="space-y-1">
    <form class="flex gap-1" @submit.prevent="submit">
      <input
        v-model="value"
        type="url"
        inputmode="url"
        placeholder="Paste a Google Fonts link…"
        class="min-w-0 flex-1 rounded-app border border-app-border bg-app-panel-2 px-3 py-2 text-sm outline-none focus:border-app-accent"
      />
      <button
        type="submit"
        class="shrink-0 rounded-app border border-app-border px-3 py-2 text-xs text-app-muted transition-colors hover:border-app-accent hover:text-app-text"
      >
        Add
      </button>
    </form>
    <p v-if="error" class="text-[10px] text-app-danger">{{ error }}</p>
    <p v-else-if="added" class="text-[10px] text-app-accent">Added {{ added }}</p>
    <p v-else class="text-[10px] text-app-muted">
      A specimen page (fonts.google.com/specimen/…) or the CSS link from “Get font”.
    </p>
  </div>
</template>
