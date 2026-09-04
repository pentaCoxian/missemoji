<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '~/stores/project'
import PanelSection from '~/components/controls/PanelSection.vue'
import SegmentedControl from '~/components/controls/SegmentedControl.vue'
import ColorPicker from '~/components/controls/ColorPicker.vue'
import AppSlider from '~/components/controls/AppSlider.vue'
import { fractionToRefPx, refPxToFraction } from '#core/project/units'

type BgKind = 'none' | 'solid' | 'blob'

const store = useProjectStore()
const { project } = storeToRefs(store)

const kinds: { value: BgKind; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'solid', label: 'Solid' },
  { value: 'blob', label: 'Rounded' },
]
const kind = computed<BgKind>(() => project.value.style.background?.type ?? 'none')
const bg = computed(() => project.value.style.background)
const blob = computed(() => (bg.value?.type === 'blob' ? bg.value : null))

function setKind(k: BgKind) {
  const color = bg.value?.color ?? '#ffffff'
  if (k === 'none') store.setBackground(null)
  else if (k === 'solid') store.setBackground({ type: 'solid', color })
  else
    store.setBackground({
      type: 'blob',
      color,
      radius: refPxToFraction(24),
      padding: refPxToFraction(4),
    })
}
function setColor(color: string) {
  if (!bg.value) return
  store.setBackground({ ...bg.value, color })
}
function setBlob(patch: { radius?: number; padding?: number }) {
  if (!blob.value) return
  store.setBackground({ ...blob.value, ...patch })
}
</script>

<template>
  <PanelSection title="Background">
    <SegmentedControl :model-value="kind" :options="kinds" @update:model-value="setKind($event)" />
    <template v-if="bg">
      <ColorPicker :model-value="bg.color" label="Color" @update:model-value="setColor" />
      <template v-if="blob">
        <AppSlider
          :model-value="fractionToRefPx(blob.radius)"
          :min="0"
          :max="64"
          label="Corner radius"
          suffix="px"
          @update:model-value="setBlob({ radius: refPxToFraction($event) })"
        />
        <AppSlider
          :model-value="fractionToRefPx(blob.padding)"
          :min="0"
          :max="32"
          label="Padding"
          suffix="px"
          @update:model-value="setBlob({ padding: refPxToFraction($event) })"
        />
      </template>
    </template>
  </PanelSection>
</template>
