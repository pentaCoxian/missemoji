<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useEditorStore } from '~/stores/editor'

/**
 * Actual-size preview strip (spec §16): shows the rendered emoji at the real
 * pixel sizes it will appear at on Misskey (24/48/72px in reactions/timeline,
 * plus full 128/256). Uses the data URL published by the preview pipeline.
 */
const editor = useEditorStore()
const { previewDataUrl, backgroundClass } = storeToRefs(editor)

const sizes = [24, 48, 72, 128]
</script>

<template>
  <div class="flex items-end justify-center gap-4">
    <div v-for="s in sizes" :key="s" class="flex flex-col items-center gap-1">
      <div
        class="flex items-center justify-center rounded"
        :class="backgroundClass"
        :style="{ width: s + 'px', height: s + 'px' }"
      >
        <img
          v-if="previewDataUrl"
          :src="previewDataUrl"
          :width="s"
          :height="s"
          :style="{ width: s + 'px', height: s + 'px' }"
          alt="preview"
        />
      </div>
      <span class="text-[10px] text-app-muted">{{ s }}px</span>
    </div>
  </div>
</template>
