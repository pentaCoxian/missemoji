<script setup lang="ts">
import { ref } from 'vue'
import { useFontsStore } from '~/stores/fonts'
import { useProjectStore } from '~/stores/project'
import { clearMeasureCache } from '#core/layout/measureText'

/**
 * Load a local .ttf/.otf/.woff/.woff2 with the FontFace API. The bytes stay in
 * memory for this session (they are also handed to the render worker) and are
 * NOT saved with the project.
 */
const fontsStore = useFontsStore()
const store = useProjectStore()
const input = ref<HTMLInputElement | null>(null)
const error = ref<string | null>(null)
const busy = ref(false)

function familyNameFor(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, '')
  const clean = stem
    .replace(/["'\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return clean || 'Custom font'
}

async function onFile(e: Event) {
  const el = e.target as HTMLInputElement
  const file = el.files?.[0]
  el.value = ''
  if (!file) return
  error.value = null
  busy.value = true
  try {
    const data = await file.arrayBuffer()
    const family = familyNameFor(file.name)
    const face = new FontFace(family, data, { weight: '400', style: 'normal', display: 'swap' })
    document.fonts.add(face)
    await face.load()
    fontsStore.addCustomFont({
      family,
      weight: 400,
      style: 'normal',
      data,
      fileName: file.name,
      bytes: data.byteLength,
    })
    clearMeasureCache()
    store.setFontFamily(family)
    store.setFontWeight(400)
  } catch (err) {
    error.value = (err as Error).message || 'Could not load that font file'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-1">
    <button
      type="button"
      class="w-full rounded-app border border-dashed border-app-border px-3 py-2 text-xs text-app-muted transition-colors hover:border-app-accent hover:text-app-text disabled:opacity-50"
      :disabled="busy"
      @click="input?.click()"
    >
      {{ busy ? 'Loading font…' : 'Upload a font file (.ttf / .otf / .woff / .woff2)' }}
    </button>
    <input
      ref="input"
      type="file"
      accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
      class="hidden"
      @change="onFile"
    />
    <p class="text-[10px] text-app-muted">
      Uploaded fonts are not saved with the project — re-upload after a reload.
    </p>
    <p v-if="error" class="text-[10px] text-app-danger">{{ error }}</p>
  </div>
</template>
