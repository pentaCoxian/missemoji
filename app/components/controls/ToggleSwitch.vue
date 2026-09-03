<script setup lang="ts">
defineProps<{ modelValue: boolean; label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <label class="flex cursor-pointer items-center justify-between gap-3">
    <span v-if="label" class="text-xs text-app-muted">{{ label }}</span>
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors"
      :class="modelValue ? 'bg-app-accent-strong' : 'bg-app-border'"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span
        class="block h-4 w-4 rounded-full bg-white shadow transition-transform"
        :class="modelValue ? 'translate-x-4' : 'translate-x-0'"
      />
    </button>
  </label>
</template>
