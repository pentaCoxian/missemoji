<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '~/stores/project'
import PanelSection from '~/components/controls/PanelSection.vue'
import ColorPicker from '~/components/controls/ColorPicker.vue'
import AppSlider from '~/components/controls/AppSlider.vue'
import ToggleSwitch from '~/components/controls/ToggleSwitch.vue'
import SegmentedControl from '~/components/controls/SegmentedControl.vue'
import BackgroundSection from '~/components/panels/style/BackgroundSection.vue'

const store = useProjectStore()
const { project } = storeToRefs(store)

// --- fill ---
const fillType = computed(() => project.value.style.fill.type)
function setFillType(type: 'solid' | 'linear-gradient') {
  if (type === 'solid') {
    store.setFill({ type: 'solid', color: '#ff5d8f' })
  } else {
    store.setFill({
      type: 'linear-gradient',
      angle: 90,
      stops: [
        { position: 0, color: '#ff7eb3' },
        { position: 1, color: '#7367f0' },
      ],
    })
  }
}
function setSolidColor(color: string) {
  store.setFill({ type: 'solid', color })
}
function setGradientStop(i: number, color: string) {
  const fill = project.value.style.fill
  if (fill.type !== 'linear-gradient') return
  const stops = fill.stops.map((s, idx) => (idx === i ? { ...s, color } : s))
  store.setFill({ ...fill, stops })
}

// Template-safe accessors (Vue's template compiler rejects the TS `!` operator).
const gradientStops = computed(() =>
  project.value.style.fill.type === 'linear-gradient' ? project.value.style.fill.stops : [],
)
const gradientAngle = computed(() =>
  project.value.style.fill.type === 'linear-gradient' ? project.value.style.fill.angle : 0,
)
const shadow0 = computed(() => project.value.style.shadows[0] ?? null)
const glow0 = computed(() => project.value.style.glows[0] ?? null)
function setGradientAngle(angle: number) {
  const fill = project.value.style.fill
  if (fill.type !== 'linear-gradient') return
  store.setFill({ ...fill, angle })
}

// --- outline (supports double outline: up to 2 strokes) ---
const strokeCount = computed(() => project.value.style.strokes.length)
function setStrokeCount(n: number) {
  const cur = project.value.style.strokes.length
  if (n > cur) {
    if (cur === 0) store.addStroke({ width: 6, color: '#ffffff' })
    if (n === 2 && project.value.style.strokes.length === 1)
      store.addStroke({ width: 10, color: '#000000' })
  } else {
    while (project.value.style.strokes.length > n)
      store.removeStroke(project.value.style.strokes.length - 1)
  }
}

const hasShadow = computed(() => project.value.style.shadows.length > 0)
function toggleShadow(on: boolean) {
  if (on) store.addShadow({ color: '#00000088', blur: 6, offsetX: 0, offsetY: 4 })
  else store.removeShadow(0)
}

const hasGlow = computed(() => project.value.style.glows.length > 0)
function toggleGlow(on: boolean) {
  if (on) store.addGlow({ color: '#ffe27a', radius: 8, intensity: 0.8 })
  else store.removeGlow(0)
}

const fillTypes = [
  { value: 'solid' as const, label: 'Solid' },
  { value: 'linear-gradient' as const, label: 'Gradient' },
]
const strokeCounts = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Single' },
  { value: 2, label: 'Double' },
]
</script>

<template>
  <div>
    <PanelSection title="Fill">
      <SegmentedControl
        :model-value="fillType"
        :options="fillTypes"
        @update:model-value="setFillType($event)"
      />
      <ColorPicker
        v-if="project.style.fill.type === 'solid'"
        :model-value="project.style.fill.color"
        label="Color"
        @update:model-value="setSolidColor"
      />
      <template v-else-if="project.style.fill.type === 'linear-gradient'">
        <ColorPicker
          v-if="gradientStops[0]"
          :model-value="gradientStops[0].color"
          label="Start"
          @update:model-value="setGradientStop(0, $event)"
        />
        <ColorPicker
          v-if="gradientStops[1]"
          :model-value="gradientStops[1].color"
          label="End"
          @update:model-value="setGradientStop(1, $event)"
        />
        <AppSlider
          :model-value="gradientAngle"
          :min="0"
          :max="360"
          label="Angle"
          suffix="°"
          @update:model-value="setGradientAngle"
        />
      </template>
    </PanelSection>

    <PanelSection title="Outline">
      <SegmentedControl
        :model-value="strokeCount"
        :options="strokeCounts"
        @update:model-value="setStrokeCount($event)"
      />
      <div
        v-for="(s, i) in project.style.strokes"
        :key="i"
        class="rounded-app bg-app-panel-2 p-2 space-y-2"
      >
        <div class="text-[10px] uppercase text-app-muted">Outline {{ i + 1 }}</div>
        <ColorPicker
          :model-value="s.color"
          label="Color"
          @update:model-value="store.updateStroke(i, { color: $event })"
        />
        <AppSlider
          :model-value="s.width"
          :min="1"
          :max="24"
          label="Width"
          suffix="px"
          @update:model-value="store.updateStroke(i, { width: $event })"
        />
      </div>
    </PanelSection>

    <PanelSection title="Shadow">
      <ToggleSwitch
        :model-value="hasShadow"
        label="Enable shadow"
        @update:model-value="toggleShadow"
      />
      <template v-if="shadow0">
        <ColorPicker
          :model-value="shadow0.color"
          label="Color"
          @update:model-value="store.updateShadow(0, { color: $event })"
        />
        <AppSlider
          :model-value="shadow0.blur"
          :min="0"
          :max="24"
          label="Blur"
          suffix="px"
          @update:model-value="store.updateShadow(0, { blur: $event })"
        />
        <AppSlider
          :model-value="shadow0.offsetY"
          :min="-16"
          :max="16"
          label="Offset Y"
          suffix="px"
          @update:model-value="store.updateShadow(0, { offsetY: $event })"
        />
      </template>
    </PanelSection>

    <PanelSection title="Glow">
      <ToggleSwitch :model-value="hasGlow" label="Enable glow" @update:model-value="toggleGlow" />
      <template v-if="glow0">
        <ColorPicker
          :model-value="glow0.color"
          label="Color"
          @update:model-value="store.updateGlow(0, { color: $event })"
        />
        <AppSlider
          :model-value="glow0.radius"
          :min="0"
          :max="32"
          label="Radius"
          suffix="px"
          @update:model-value="store.updateGlow(0, { radius: $event })"
        />
      </template>
    </PanelSection>

    <BackgroundSection />
  </div>
</template>
