<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useEditorStore } from '~/stores/editor'
import { useProjectStore } from '~/stores/project'

const editor = useEditorStore()
const project = useProjectStore()
const { playback } = storeToRefs(editor)

function onScrub(e: Event) {
  editor.setPlaying(false)
  editor.setCurrentFrame(Number((e.target as HTMLInputElement).value))
}
</script>

<template>
  <div
    v-if="project.isAnimated"
    class="flex items-center gap-3 rounded-app bg-app-panel-2 px-3 py-1.5"
  >
    <button
      type="button"
      class="text-sm"
      :aria-label="playback.playing ? 'pause' : 'play'"
      @click="editor.setPlaying(!playback.playing)"
    >
      {{ playback.playing ? '⏸' : '▶️' }}
    </button>
    <input
      type="range"
      class="app-range flex-1"
      :min="0"
      :max="Math.max(0, playback.frameCount - 1)"
      :value="playback.currentFrame"
      @input="onScrub"
    />
    <span class="w-12 text-right text-[10px] tabular-nums text-app-muted">
      {{ playback.currentFrame + 1 }}/{{ playback.frameCount }}
    </span>
  </div>
</template>
