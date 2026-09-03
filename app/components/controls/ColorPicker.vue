<script setup lang="ts">
defineProps<{ modelValue: string; label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <label class="flex items-center justify-between gap-3">
    <span v-if="label" class="text-xs text-app-muted">{{ label }}</span>
    <span class="flex items-center gap-2">
      <input
        type="color"
        class="h-7 w-9 cursor-pointer rounded border border-app-border bg-transparent p-0"
        :value="modelValue"
        @input="onInput"
      />
      <input
        type="text"
        class="w-20 rounded border border-app-border bg-app-panel-2 px-2 py-1 text-xs tabular-nums"
        :value="modelValue"
        @input="onInput"
      />
    </span>
  </label>
</template>
