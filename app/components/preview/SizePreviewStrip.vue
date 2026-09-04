<script setup lang="ts">
import { watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '~/stores/editor'
import { usePreviewFrames } from '~/composables/usePreviewFrames'

/**
 * Actual-size preview strip (spec §16): the current preview bitmap drawn at
 * the real pixel sizes an emoji appears at on Misskey (24/32/48/72px in
 * reactions/timeline, plus full 128). Follows playback frame by frame.
 */
const editor = useEditorStore()
const { backgroundClass } = storeToRefs(editor)
const { currentBitmap } = usePreviewFrames()

const sizes = [24, 32, 48, 72, 128]
const canvases = new Map<number, HTMLCanvasElement>()

function setCanvas(size: number, el: unknown) {
  if (el instanceof HTMLCanvasElement) canvases.set(size, el)
  else canvases.delete(size)
}

function draw() {
  const bmp = currentBitmap.value
  for (const [size, canvas] of canvases) {
    if (canvas.width !== size) {
      canvas.width = size
      canvas.height = size
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    ctx.clearRect(0, 0, size, size)
    if (!bmp) continue
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bmp, 0, 0, size, size)
  }
}

watch(currentBitmap, draw)
onMounted(draw)
</script>

<template>
  <div class="flex items-end justify-center gap-4">
    <div v-for="s in sizes" :key="s" class="flex flex-col items-center gap-1">
      <div
        class="flex items-center justify-center overflow-hidden rounded"
        :class="backgroundClass"
        :style="{ width: s + 'px', height: s + 'px' }"
      >
        <canvas
          :ref="(el) => setCanvas(s, el)"
          :width="s"
          :height="s"
          :style="{ width: s + 'px', height: s + 'px' }"
        />
      </div>
      <span class="text-[10px] text-app-muted">{{ s }}px</span>
    </div>
  </div>
</template>
