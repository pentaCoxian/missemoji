<script setup lang="ts" generic="T extends string | number">
defineProps<{
  modelValue: T
  options: { value: T; label: string }[]
  label?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
</script>

<template>
  <div>
    <div v-if="label" class="mb-1 text-xs text-app-muted">{{ label }}</div>
    <div class="flex flex-wrap gap-1 rounded-app bg-app-panel-2 p-1">
      <button
        v-for="opt in options"
        :key="String(opt.value)"
        type="button"
        class="flex-1 rounded px-2 py-1 text-xs transition-colors"
        :class="
          opt.value === modelValue
            ? 'bg-app-accent-strong text-white'
            : 'text-app-muted hover:text-app-text'
        "
        @click="emit('update:modelValue', opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>
