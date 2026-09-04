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
    <ToggleSwitch
      v-if="hasItalic"
      :model-value="project.font.style === 'italic'"
      label="Italic"
      @update:model-value="store.setFontStyle($event ? 'italic' : 'normal')"
    />
    <FontWeightControl />
    <FontPicker />
    <FontUrlInput />
    <FontUpload />
  </PanelSection>
</template>
