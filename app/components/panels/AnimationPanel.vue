<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '~/stores/project'
import PanelSection from '~/components/controls/PanelSection.vue'
import ToggleSwitch from '~/components/controls/ToggleSwitch.vue'
import AppSlider from '~/components/controls/AppSlider.vue'
import ChoiceButton from '~/components/controls/ChoiceButton.vue'
import { PRESETS, getPreset } from '#core/animation/presets'

const store = useProjectStore()
const { project } = storeToRefs(store)

const activePreset = computed(() => getPreset(project.value.animation.preset))

// Resolve current value for a preset param (user override or default).
function paramValue(key: string, fallback: number): number {
  const v = project.value.animation.params[key]
  return typeof v === 'number' ? v : fallback
}

// Sensible slider ranges per known param name.
function rangeFor(key: string): { min: number; max: number; step: number } {
  switch (key) {
    case 'degrees':
      return { min: 1, max: 30, step: 1 }
    case 'freq':
      return { min: 2, max: 12, step: 1 }
    case 'min':
    case 'max':
      return { min: 0, max: 2, step: 0.05 }
    default:
      return { min: 0, max: 0.4, step: 0.01 }
  }
}
</script>

<template>
  <div>
    <PanelSection title="Animation">
      <ToggleSwitch
        :model-value="project.animation.enabled"
        label="Animate"
        @update:model-value="store.setAnimationEnabled($event)"
      />
      <template v-if="project.animation.enabled">
        <div class="grid grid-cols-2 gap-1">
          <ChoiceButton
            v-for="preset in PRESETS"
            :key="preset.id"
            class="px-2 py-2 text-xs"
            :active="preset.id === project.animation.preset"
            @click="store.setPreset(preset.id)"
          >
            {{ preset.label }}
          </ChoiceButton>
        </div>

        <!-- Per-preset parameter sliders -->
        <template v-if="activePreset">
          <AppSlider
            v-for="(def, key) in activePreset.defaultParams"
            :key="key"
            :model-value="paramValue(key, def)"
            :min="rangeFor(key).min"
            :max="rangeFor(key).max"
            :step="rangeFor(key).step"
            :label="key"
            @update:model-value="store.setAnimParam(key, $event)"
          />
        </template>

        <AppSlider
          :model-value="project.animation.fps"
          :min="6"
          :max="24"
          label="FPS"
          @update:model-value="store.setFps($event)"
        />
        <AppSlider
          :model-value="project.animation.durationMs"
          :min="400"
          :max="2000"
          :step="100"
          label="Duration"
          suffix="ms"
          @update:model-value="store.setDuration($event)"
        />
        <ToggleSwitch
          :model-value="project.animation.loop"
          label="Loop"
          @update:model-value="store.setLoop($event)"
        />
      </template>
    </PanelSection>
  </div>
</template>
