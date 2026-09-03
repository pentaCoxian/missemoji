<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '~/stores/project'
import PanelSection from '~/components/controls/PanelSection.vue'
import ToggleSwitch from '~/components/controls/ToggleSwitch.vue'
import AppSlider from '~/components/controls/AppSlider.vue'
import ChoiceButton from '~/components/controls/ChoiceButton.vue'
import SegmentedControl from '~/components/controls/SegmentedControl.vue'
import type { AnimDirection } from '#core/project/schema'
import { PRESETS, getPreset } from '#core/animation/presets'

const store = useProjectStore()
const { project } = storeToRefs(store)

const activePreset = computed(() => getPreset(project.value.animation.preset))

const directions: { value: AnimDirection; label: string }[] = [
  { value: 'forward', label: 'Forward' },
  { value: 'reverse', label: 'Reverse' },
  { value: 'pingpong', label: 'Ping-pong' },
]

// Resolve current value for a preset param (user override or default).
function paramValue(key: string, fallback: number): number {
  const v = project.value.animation.params[key]
  return typeof v === 'number' ? v : fallback
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
            v-for="def in activePreset.params"
            :key="def.key"
            :model-value="paramValue(def.key, def.default)"
            :min="def.min"
            :max="def.max"
            :step="def.step"
            :label="def.label"
            :suffix="def.unit"
            @update:model-value="store.setAnimParam(def.key, $event)"
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
        <SegmentedControl
          :model-value="project.animation.direction"
          :options="directions"
          label="Direction"
          @update:model-value="store.setDirection($event)"
        />
        <AppSlider
          :model-value="project.animation.hold"
          :min="0"
          :max="0.5"
          :step="0.05"
          label="Hold at rest"
          @update:model-value="store.setHold($event)"
        />
        <AppSlider
          :model-value="project.animation.phase"
          :min="0"
          :max="1"
          :step="0.05"
          label="Phase"
          @update:model-value="store.setPhase($event)"
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
