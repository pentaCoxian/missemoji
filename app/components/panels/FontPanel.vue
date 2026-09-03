<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '~/stores/project'
import PanelSection from '~/components/controls/PanelSection.vue'
import ToggleSwitch from '~/components/controls/ToggleSwitch.vue'
import FontPicker from '~/components/fonts/FontPicker.vue'
import FontUpload from '~/components/fonts/FontUpload.vue'
import { getFontDescriptor } from '#core/fonts/catalog'

const store = useProjectStore()
const { project } = storeToRefs(store)
const hasItalic = computed(() => !!getFontDescriptor(project.value.font.family)?.italic)
</script>

<template>
  <PanelSection title="Font">
    <ToggleSwitch
      v-if="hasItalic"
      :model-value="project.font.style === 'italic'"
      label="Italic"
      @update:model-value="store.setFontStyle($event ? 'italic' : 'normal')"
    />
    <FontPicker />
    <FontUpload />
  </PanelSection>
</template>
