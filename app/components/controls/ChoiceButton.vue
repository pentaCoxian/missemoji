<script setup lang="ts">
/**
 * A selectable option button (preset tile, size chip, font row). Layout classes
 * (padding, width, text) come from the caller via the fall-through `class`;
 * this component only owns the selected / idle border styling.
 */
defineProps<{ active: boolean }>()
</script>

<template>
  <button
    type="button"
    class="rounded-app border transition-colors"
    :class="
      active ? 'border-app-accent bg-app-panel-2' : 'border-app-border hover:border-app-accent'
    "
  >
    <slot />
  </button>
</template>
