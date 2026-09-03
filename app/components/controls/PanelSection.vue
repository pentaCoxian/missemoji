<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <section class="space-y-3 border-b border-app-border px-4 py-4 last:border-b-0">
    <h3 class="text-xs font-semibold uppercase tracking-wide text-app-muted">
      {{ title }}
    </h3>
    <div class="space-y-3">
      <slot />
    </div>
  </section>
</template>
