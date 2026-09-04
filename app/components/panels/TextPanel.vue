<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useProjectStore } from '~/stores/project'
import PanelSection from '~/components/controls/PanelSection.vue'
import SegmentedControl from '~/components/controls/SegmentedControl.vue'
import ToggleSwitch from '~/components/controls/ToggleSwitch.vue'
import AppSlider from '~/components/controls/AppSlider.vue'
import BatchSection from '~/components/panels/BatchSection.vue'
import { fractionToRefPx, refPxToFraction } from '#core/project/units'
import type { Align, LayoutMode, VerticalAlign } from '#core/project/schema'

const store = useProjectStore()
const { project } = storeToRefs(store)

const layoutModes: { value: LayoutMode; label: string }[] = [
  { value: 'fit', label: 'Fit' },
  { value: 'fill', label: 'Fill' },
  { value: 'safe', label: 'Safe' },
  { value: 'compact', label: 'Compact' },
  { value: 'jp-balanced', label: 'JP' },
  { value: 'impact', label: 'Impact' },
]
const aligns: { value: Align; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]
const vAligns: { value: VerticalAlign; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'middle', label: 'Middle' },
  { value: 'bottom', label: 'Bottom' },
]
</script>

<template>
  <div>
    <PanelSection title="Text">
      <textarea
        :value="project.text"
        rows="3"
        class="w-full resize-none rounded-app border border-app-border bg-app-panel-2 px-3 py-2 text-sm leading-snug outline-none focus:border-app-accent"
        placeholder="Type your emoji text…"
        @input="store.setText(($event.target as HTMLTextAreaElement).value)"
      />
      <ToggleSwitch
        :model-value="project.layout.manualLineBreaks"
        label="Honor manual line breaks"
        @update:model-value="store.setManualLineBreaks($event)"
      />
    </PanelSection>

    <BatchSection />

    <PanelSection title="Layout">
      <SegmentedControl
        :model-value="project.layout.mode"
        :options="layoutModes"
        label="Mode"
        @update:model-value="store.setLayoutMode($event)"
      />
      <SegmentedControl
        :model-value="project.layout.align"
        :options="aligns"
        label="Align"
        @update:model-value="store.setAlign($event)"
      />
      <SegmentedControl
        :model-value="project.layout.verticalAlign"
        :options="vAligns"
        label="Vertical"
        @update:model-value="store.setVerticalAlign($event)"
      />
      <AppSlider
        :model-value="fractionToRefPx(project.layout.padding)"
        :min="0"
        :max="32"
        label="Padding"
        suffix="px"
        @update:model-value="store.setPadding(refPxToFraction($event))"
      />
    </PanelSection>

    <PanelSection title="Typography">
      <AppSlider
        :model-value="fractionToRefPx(project.font.letterSpacing)"
        :min="-10"
        :max="20"
        label="Letter spacing"
        suffix="px"
        @update:model-value="store.setLetterSpacing(refPxToFraction($event))"
      />
      <AppSlider
        :model-value="project.font.lineHeight"
        :min="0.7"
        :max="2"
        :step="0.05"
        label="Line height"
        @update:model-value="store.setLineHeight($event)"
      />
      <AppSlider
        :model-value="project.font.weight"
        :min="100"
        :max="900"
        :step="100"
        label="Weight"
        @update:model-value="store.setFontWeight($event)"
      />
    </PanelSection>
  </div>
</template>
