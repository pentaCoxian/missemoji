<script setup lang="ts">
import type { Warning } from '#core/export/sizeEstimate'

defineProps<{ warnings: Warning[] }>()

const colorFor = (level: Warning['level']) => {
  switch (level) {
    case 'error':
      return 'text-app-danger'
    case 'warn':
      return 'text-app-warn'
    default:
      return 'text-app-muted'
  }
}
const iconFor = (level: Warning['level']) =>
  level === 'error' ? '⛔' : level === 'warn' ? '⚠️' : 'ℹ️'
</script>

<template>
  <ul v-if="warnings.length" class="space-y-1">
    <li
      v-for="(w, i) in warnings"
      :key="i"
      class="flex items-start gap-1.5 text-xs"
      :class="colorFor(w.level)"
    >
      <span>{{ iconFor(w.level) }}</span>
      <span>{{ w.message }}</span>
    </li>
  </ul>
</template>
