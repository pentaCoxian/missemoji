<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useFontsStore } from '~/stores/fonts'
import { useFontResolver } from '~/composables/useFontResolver'
import { loadGoogleFont } from '#core/fonts/loadFont'

/**
 * One row of the font list, previewing the user's own emoji text in that font.
 *
 * The font is only fetched once the row is actually on screen (IntersectionObserver):
 * previewing 40 families eagerly — several of them large Japanese faces — would
 * cost megabytes before the user scrolls.
 */
const props = defineProps<{
  family: string
  /** the text to preview; falls back to the family name when empty */
  sample: string
  /** uploaded fonts are already registered, so never fetch them */
  preloaded?: boolean
}>()

const fontsStore = useFontsStore()
const { resolve } = useFontResolver()

const el = ref<HTMLElement | null>(null)
const ready = ref(false)
let observer: IntersectionObserver | null = null

const text = computed(() => (props.sample.trim() ? props.sample : props.family))
/** Fall back to the UI font until the face is available, so rows never go blank. */
const style = computed(() =>
  ready.value ? { fontFamily: `'${props.family}', sans-serif`, fontWeight: 400 } : undefined,
)

async function load() {
  if (ready.value) return
  if (props.preloaded || fontsStore.isLoaded(props.family)) {
    ready.value = true
    return
  }
  const { descriptor } = resolve(props.family)
  if (!descriptor) return
  try {
    // Preview only needs the regular weight, subset to the sample text.
    await loadGoogleFont(descriptor, { weights: [400], text: text.value })
    ready.value = true
  } catch {
    // leave the fallback font in place; the row is still selectable
  }
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') {
    void load()
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer?.disconnect()
        observer = null
        void load()
      }
    },
    { rootMargin: '120px' },
  )
  if (el.value) observer.observe(el.value)
})

onBeforeUnmount(() => observer?.disconnect())

// A newly uploaded font is registered outside this component.
watch(
  () => props.preloaded,
  (v) => {
    if (v) ready.value = true
  },
)
</script>

<template>
  <span ref="el" class="block truncate text-lg leading-tight" :style="style" :title="family">
    {{ text }}
  </span>
</template>
