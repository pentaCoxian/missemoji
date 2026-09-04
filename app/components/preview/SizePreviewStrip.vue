<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '~/stores/editor'
import { usePreviewFrames } from '~/composables/usePreviewFrames'

/**
 * Actual-size preview strip: the current preview bitmap at the CSS sizes a
 * custom emoji really occupies on Misskey.
 *
 * Misskey serves reaction/MFM emoji through the media proxy at `height: 128`
 * webp and displays them with `MkCustomEmoji`: `.normal { height: 1.25em }`
 * inside a reaction chip whose font-size follows the chip size (`small` 1em,
 * default 1.5em, `large` 2em) against a 14px root. So the real heights are
 * ~17.5 / 26 / 35 CSS px — the browser is downscaling a 128px source, never
 * showing it 1:1. Our rungs mirror those, plus 128 (the served source).
 */
const editor = useEditorStore()
const { backgroundClass } = storeToRefs(editor)
const { currentBitmap } = usePreviewFrames()

/** Misskey's own reaction/emoji display heights, in CSS px. */
const sizes: { px: number; label: string }[] = [
  { px: 18, label: 'reaction' },
  { px: 26, label: 'in text' },
  { px: 35, label: 'large' },
  { px: 64, label: 'picker' },
  { px: 128, label: 'source' },
]
// On phones the big rungs eat too much vertical space (and 128 nearly
// duplicates the main preview), so only the small reaction/timeline sizes
// stay; the full ladder returns from `sm` up.
const MOBILE_MAX = 35
const canvases = new Map<number, HTMLCanvasElement>()

// Match the device pixel ratio: a 32-CSS-px canvas with a 32px backing store
// is upscaled by the browser on a retina screen, which is exactly the
// pixelation Misskey does not show (it downsamples a 128px source instead).
const dpr = ref(1)
let mq: MediaQueryList | null = null

function watchDpr() {
  if (typeof window === 'undefined') return
  dpr.value = window.devicePixelRatio || 1
  mq?.removeEventListener('change', onDprChange)
  mq = window.matchMedia(`(resolution: ${dpr.value}dppx)`)
  mq.addEventListener('change', onDprChange)
}

function onDprChange() {
  watchDpr()
  draw()
}

function setCanvas(size: number, el: unknown) {
  if (el instanceof HTMLCanvasElement) canvases.set(size, el)
  else canvases.delete(size)
}

function draw() {
  const bmp = currentBitmap.value
  const ratio = dpr.value
  for (const [size, canvas] of canvases) {
    const px = Math.round(size * ratio)
    if (canvas.width !== px) {
      canvas.width = px
      canvas.height = px
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    ctx.clearRect(0, 0, px, px)
    if (!bmp) continue
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bmp, 0, 0, px, px)
  }
}

watch(currentBitmap, draw)
watch(dpr, draw)
onMounted(() => {
  watchDpr()
  draw()
})
onBeforeUnmount(() => mq?.removeEventListener('change', onDprChange))
</script>

<template>
  <div class="flex shrink-0 items-end justify-center gap-2 sm:gap-4">
    <div
      v-for="s in sizes"
      :key="s.px"
      class="shrink-0 flex-col items-center gap-0.5 lg:gap-1"
      :class="s.px > MOBILE_MAX ? 'hidden sm:flex' : 'flex'"
    >
      <div
        class="flex items-center justify-center overflow-hidden rounded"
        :class="backgroundClass"
        :style="{ width: s.px + 'px', height: s.px + 'px' }"
      >
        <canvas
          :ref="(el) => setCanvas(s.px, el)"
          :style="{ width: s.px + 'px', height: s.px + 'px' }"
        />
      </div>
      <!-- The label is wider than the small swatches; keeping it on one line
           lets it set the column width so the swatches stay evenly spaced
           and bottom-aligned instead of wrapping into a ragged row. -->
      <span class="whitespace-nowrap text-[10px] leading-none text-app-muted">{{ s.label }}</span>
    </div>
  </div>
</template>
