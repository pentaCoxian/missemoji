<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '~/stores/project'
import { useExportStore } from '~/stores/export'
import { useEditorStore } from '~/stores/editor'
import { useFontsStore } from '~/stores/fonts'
import { useExport } from '~/composables/useExport'
import PanelSection from '~/components/controls/PanelSection.vue'
import SegmentedControl from '~/components/controls/SegmentedControl.vue'
import ChoiceButton from '~/components/controls/ChoiceButton.vue'
import WarningList from '~/components/warnings/WarningList.vue'
import ExportPresetSelect from '~/components/presets/ExportPresetSelect.vue'
import type { ExportFormat, OptimizeFor } from '#core/project/schema'
import { parseBatchLines } from '#core/export/batch'
import { getFontDescriptor } from '#core/fonts/catalog'
import type { Warning } from '#core/export/sizeEstimate'

const store = useProjectStore()
const exportStore = useExportStore()
const editor = useEditorStore()
const { project } = storeToRefs(store)
const { apngEngine } = storeToRefs(editor)
const { start, startBatch, cancel } = useExport()
const batchCount = computed(() => parseBatchLines(editor.batchText).length)

const fontsStore = useFontsStore()
const GENERIC_FAMILIES = new Set(['sans-serif', 'serif', 'monospace', 'system-ui', 'cursive'])
/** Font problems that would make the export differ from what the user expects. */
const fontWarnings = computed<Warning[]>(() => {
  const family = project.value.font.family
  const out: Warning[] = []
  if (fontsStore.isFailed(family)) {
    out.push({
      level: 'warn',
      message: `Font "${family}" failed to load — a fallback font is shown and exported.`,
    })
  } else if (
    !getFontDescriptor(family) &&
    !fontsStore.customFont(family) &&
    !GENERIC_FAMILIES.has(family)
  ) {
    out.push({
      level: 'warn',
      message: `Custom font "${family}" is not loaded in this session — re-upload it.`,
    })
  }
  return out
})

const formats: { value: ExportFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'apng', label: 'APNG' },
  { value: 'gif', label: 'GIF' },
]
const engines: { value: 'upng' | 'wasm'; label: string }[] = [
  { value: 'upng', label: 'upng-js' },
  { value: 'wasm', label: 'Rust WASM' },
]
const optimize: { value: OptimizeFor; label: string }[] = [
  { value: 'quality', label: 'Quality' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'size', label: 'Size' },
]
const sizes = [
  { w: 128, h: 128, label: '128' },
  { w: 256, h: 256, label: '256' },
]
const renderScales: { value: number; label: string }[] = [
  { value: 2, label: '2×' },
  { value: 4, label: '4×' },
  { value: 8, label: '8×' },
]
</script>

<template>
  <div>
    <PanelSection title="Misskey Presets">
      <ExportPresetSelect />
    </PanelSection>

    <PanelSection title="Export">
      <SegmentedControl
        :model-value="project.export.format"
        :options="formats"
        label="Format"
        @update:model-value="store.setExportFormat($event)"
      />
      <div>
        <div class="mb-1 text-xs text-app-muted">Size</div>
        <div class="flex gap-1">
          <ChoiceButton
            v-for="s in sizes"
            :key="s.label"
            class="flex-1 px-2 py-1 text-xs"
            :active="project.export.finalWidth === s.w"
            @click="store.setFinalSize(s.w, s.h)"
          >
            {{ s.label }}×{{ s.label }}
          </ChoiceButton>
        </div>
      </div>
      <div>
        <SegmentedControl
          :model-value="project.export.renderScale"
          :options="renderScales"
          label="Render scale"
          @update:model-value="store.setRenderScale($event)"
        />
        <p class="mt-1 text-[10px] text-app-muted">
          Supersampling for cleaner edges. 8× renders up to 2048px surfaces; exports take longer.
        </p>
      </div>
      <SegmentedControl
        :model-value="project.export.optimizeFor"
        :options="optimize"
        label="Optimize for"
        @update:model-value="store.setOptimizeFor($event)"
      />
      <SegmentedControl
        v-if="project.export.format === 'apng'"
        :model-value="apngEngine"
        :options="engines"
        label="APNG engine"
        @update:model-value="editor.setApngEngine($event)"
      />
    </PanelSection>

    <PanelSection title="Download">
      <button
        v-if="!exportStore.isBusy && !editor.batchMode"
        type="button"
        class="w-full rounded-app bg-app-accent-strong px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        @click="start()"
      >
        Download {{ project.export.format.toUpperCase() }}
      </button>
      <button
        v-else-if="!exportStore.isBusy"
        type="button"
        class="w-full rounded-app bg-app-accent-strong px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        :disabled="batchCount === 0"
        @click="startBatch(editor.batchText)"
      >
        Download ZIP ({{ batchCount }} × {{ project.export.format.toUpperCase() }})
      </button>
      <div v-else class="space-y-2">
        <div class="h-2 w-full overflow-hidden rounded-full bg-app-panel-2">
          <div
            class="h-full bg-app-accent-strong transition-all"
            :style="{ width: Math.round(exportStore.progress * 100) + '%' }"
          />
        </div>
        <button
          type="button"
          class="w-full rounded-app border border-app-border px-3 py-2 text-xs text-app-muted hover:text-app-text"
          @click="cancel()"
        >
          Cancel ({{ exportStore.status
          }}<template v-if="exportStore.batch">
            · {{ exportStore.batch.done }}/{{ exportStore.batch.total }}</template
          >)
        </button>
      </div>

      <p v-if="exportStore.lastResult" class="text-xs text-app-muted">
        Last export: {{ exportStore.lastResult.filename }} ·
        {{ Math.round(exportStore.lastResult.bytes / 1024) }}KB<template
          v-if="exportStore.lastResult.backendUsed"
        >
          · {{ exportStore.lastResult.backendUsed }}</template
        >
      </p>

      <WarningList :warnings="[...fontWarnings, ...exportStore.warnings]" />
    </PanelSection>
  </div>
</template>
