<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '~/stores/editor'
import PanelSection from '~/components/controls/PanelSection.vue'
import ToggleSwitch from '~/components/controls/ToggleSwitch.vue'
import { parseBatchLines, BATCH_MAX } from '#core/export/batch'

const editor = useEditorStore()
const { batchMode, batchText } = storeToRefs(editor)
const count = computed(() => parseBatchLines(batchText.value).length)
</script>

<template>
  <PanelSection title="Batch">
    <ToggleSwitch
      :model-value="batchMode"
      label="Batch mode (one emoji per line)"
      @update:model-value="editor.setBatchMode($event)"
    />
    <template v-if="batchMode">
      <textarea
        :value="batchText"
        rows="6"
        class="w-full resize-none rounded-app border border-app-border bg-app-panel-2 px-3 py-2 text-sm leading-snug outline-none focus:border-app-accent"
        placeholder="One emoji text per line…"
        @input="editor.setBatchText(($event.target as HTMLTextAreaElement).value)"
      />
      <p class="text-[10px] text-app-muted">
        {{ count }} / {{ BATCH_MAX }} emojis · font, style and animation come from the current
        project. Export as a ZIP from the Download panel.
      </p>
    </template>
  </PanelSection>
</template>
