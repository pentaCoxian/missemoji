<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '~/stores/editor'
import { useProjectStore } from '~/stores/project'
import { usePreviewPipeline } from '~/composables/usePreviewPipeline'

const editor = useEditorStore()
const projectStore = useProjectStore()
const { backgroundMode } = storeToRefs(editor)
const { project } = storeToRefs(projectStore)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const { init } = usePreviewPipeline(canvasRef)

onMounted(() => {
  init()
})

const bgClass = computed(() => {
  switch (backgroundMode.value) {
    case 'dark':
      return 'bg-[#15171c]'
    case 'light':
      return 'bg-[#f4f5f7]'
    default:
      return 'checkerboard'
  }
})

// Display the final-size canvas scaled up for a comfortable editing view.
const displaySize = 320
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-6">
    <div
      class="flex items-center justify-center overflow-hidden rounded-app shadow-lg"
      :class="bgClass"
      :style="{ width: displaySize + 'px', height: displaySize + 'px' }"
    >
      <canvas
        ref="canvasRef"
        class="[image-rendering:auto]"
        :style="{ width: displaySize + 'px', height: displaySize + 'px' }"
      />
    </div>

    <div class="text-center text-xs text-app-muted">
      Final size: {{ project.export.finalWidth }}×{{ project.export.finalHeight }} · render
      {{ project.export.renderScale }}×
    </div>
  </div>
</template>
