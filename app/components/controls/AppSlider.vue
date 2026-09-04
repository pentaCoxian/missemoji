<script setup lang="ts">
import { createSliderTouchGuard } from '~~/core/ui/sliderTouchGuard'

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

// Scrolling the panel past a slider must not change its value; see the
// guard for what counts as a drag.
const { shouldIgnoreInput, handlers } = createSliderTouchGuard(() => props.modelValue)

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  if (shouldIgnoreInput(el)) return
  emit('update:modelValue', Number(el.value))
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
      v-on="handlers"
      @input="onInput"
    />
  </label>
</template>
