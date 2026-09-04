<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '~/stores/project'
import PanelSection from '~/components/controls/PanelSection.vue'
import ToggleSwitch from '~/components/controls/ToggleSwitch.vue'
import FontPicker from '~/components/fonts/FontPicker.vue'
import FontUpload from '~/components/fonts/FontUpload.vue'
import FontUrlInput from '~/components/fonts/FontUrlInput.vue'
import FontWeightControl from '~/components/fonts/FontWeightControl.vue'
import { useFontResolver } from '~/composables/useFontResolver'

const store = useProjectStore()
const { project } = storeToRefs(store)
const { resolve } = useFontResolver()
const hasItalic = computed(() => resolve(project.value.font.family).italic)
</script>

<template>
  <PanelSection title="Font">
    <!-- On mobile the weight buttons and the Google Fonts loader jump to the
         top (the picker list is long); desktop keeps the DOM order. -->
    <div class="flex flex-col gap-3">
      <FontPicker class="order-4 lg:order-none" />
      <FontWeightControl class="order-1 lg:order-none" />
      <ToggleSwitch
        v-if="hasItalic"
        class="order-3 lg:order-none"
        :model-value="project.font.style === 'italic'"
        label="Italic"
        @update:model-value="store.setFontStyle($event ? 'italic' : 'normal')"
      />
      <FontUrlInput class="order-2 lg:order-none" />
      <FontUpload class="order-5 lg:order-none" />
    </div>
  </PanelSection>
</template>
