<script setup lang="ts">
import { useProjectStore } from '~/stores/project'
import { EXPORT_PRESETS } from '#core/presets/exportPresets'

const store = useProjectStore()

function applyPreset(id: string) {
  const preset = EXPORT_PRESETS.find((p) => p.id === id)
  if (!preset) return
  // Mutate a draft and load it so a single change classifies correctly.
  const draft = store.serialize()
  preset.apply(draft)
  store.loadProject(draft)
}
</script>

<template>
  <div class="space-y-1">
    <button
      v-for="preset in EXPORT_PRESETS"
      :key="preset.id"
      type="button"
      class="w-full rounded-app border border-app-border px-3 py-2 text-left transition-colors hover:border-app-accent"
      @click="applyPreset(preset.id)"
    >
      <div class="text-sm">{{ preset.label }}</div>
      <div class="text-[10px] text-app-muted">{{ preset.description }}</div>
    </button>
  </div>
</template>
