<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useEditorStore } from '~/stores/editor'
import type { BackgroundMode } from '~/stores/editor'

const editor = useEditorStore()
const { backgroundMode } = storeToRefs(editor)

const modes: { value: BackgroundMode; label: string }[] = [
  { value: 'checker', label: 'Checker' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
]
</script>

<template>
  <div class="flex gap-1 rounded-app bg-app-panel-2 p-1">
    <button
      v-for="m in modes"
      :key="m.value"
      type="button"
      class="rounded px-3 py-1 text-xs transition-colors"
      :class="
        m.value === backgroundMode
          ? 'bg-app-accent-strong text-white'
          : 'text-app-muted hover:text-app-text'
      "
      @click="editor.setBackgroundMode(m.value)"
    >
      {{ m.label }}
    </button>
  </div>
</template>
