<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    step?: number
    label?: string
    suffix?: string
  }>(),
  { min: 0, max: 100, step: 1 },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function onInput(e: Event) {
  emit('update:modelValue', Number((e.target as HTMLInputElement).value))
}
</script>

<template>
  <label class="block">
    <div v-if="label" class="mb-1 flex items-center justify-between text-xs text-app-muted">
      <span>{{ label }}</span>
      <span class="tabular-nums text-app-text">{{ modelValue }}{{ suffix ?? '' }}</span>
    </div>
    <input
      class="app-range"
      type="range"
      :min="props.min"
      :max="props.max"
      :step="props.step"
      :value="modelValue"
      @input="onInput"
    />
  </label>
</template>
