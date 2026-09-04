<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '~/stores/project'
import { useFontResolver } from '~/composables/useFontResolver'
import ChoiceButton from '~/components/controls/ChoiceButton.vue'

/**
 * Weight picker limited to the weights the ACTIVE family actually ships, so a
 * single-weight font can't be set to a faux-bold that the renderer would fall
 * back from. Hidden when there is only one weight to choose.
 */
const store = useProjectStore()
const { project } = storeToRefs(store)
const { resolve } = useFontResolver()

const weights = computed(() => resolve(project.value.font.family).weights)

const LABELS: Record<number, string> = {
  100: 'Thin',
  200: 'ExtraLight',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
}
</script>

<template>
  <div v-if="weights.length > 1">
    <div class="mb-1 text-xs text-app-muted">Weight</div>
    <div class="flex flex-wrap gap-1">
      <ChoiceButton
        v-for="w in weights"
        :key="w"
        class="px-2 py-1 text-xs"
        :active="w === project.font.weight"
        :title="LABELS[w] ?? String(w)"
        @click="store.setFontWeight(w)"
      >
        {{ w }}
      </ChoiceButton>
    </div>
  </div>
</template>
