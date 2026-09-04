<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '~/stores/editor'
import { useProjectStore } from '~/stores/project'
import { usePreviewPipeline } from '~/composables/usePreviewPipeline'
import { usePreviewFrames } from '~/composables/usePreviewFrames'

const editor = useEditorStore()
const projectStore = useProjectStore()
const { backgroundClass } = storeToRefs(editor)
const { project } = storeToRefs(projectStore)
const { status, error, renderer } = usePreviewFrames()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const { init } = usePreviewPipeline(canvasRef)

onMounted(() => {
  init()
})

const statusLabel = computed(() => {
  switch (status.value) {
    case 'solving':
    case 'rendering':
      return 'rendering…'
    case 'error':
      return `render failed: ${error.value ?? 'unknown error'}`
    default:
      return ''
  }
})
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-2 lg:gap-6">
    <!-- Desktop gets a fixed 320px stage. On mobile the canvas is square and
         must fit BOTH axes: 60vw keeps it off the side edges, and the 26svh
         term keeps it from eating the panel space when the viewport is short
         — svh is the URL-bar-visible height, so the layout does not jump as
         the bar hides and shows. -->
    <div class="relative w-[min(60vw,26svh,240px)] lg:w-[320px]">
      <div
        class="flex aspect-square items-center justify-center overflow-hidden rounded-app shadow-lg"
        :class="backgroundClass"
      >
        <canvas ref="canvasRef" class="h-full w-full [image-rendering:auto]" />
      </div>
      <div
        v-if="statusLabel"
        class="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-app-panel/80 px-2 py-0.5 text-[10px]"
        :class="status === 'error' ? 'text-app-danger' : 'text-app-muted'"
      >
        <span
          class="inline-block h-1.5 w-1.5 rounded-full"
          :class="status === 'error' ? 'bg-app-danger' : 'animate-pulse bg-app-accent'"
        />
        {{ statusLabel }}
      </div>
    </div>

    <div class="hidden text-center text-app-muted lg:block lg:text-xs">
      Final size: {{ project.export.finalWidth }}×{{ project.export.finalHeight }} · render
      {{ project.export.renderScale }}×
      <span v-if="renderer === 'main'" title="Fonts are not available to the render worker here">
        · main-thread renderer
      </span>
    </div>
  </div>
</template>
