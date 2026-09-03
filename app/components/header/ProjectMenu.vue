<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '~/stores/project'
import { useHistory } from '~/composables/useHistory'
import { useProjectFile } from '~/composables/useProjectFile'

const projectStore = useProjectStore()
const { canUndo, canRedo, undo, redo } = useHistory()
const { saveJson, loadJson, copyShareLink } = useProjectFile()

const fileInput = ref<HTMLInputElement | null>(null)
const notice = ref<{ text: string; error: boolean } | null>(null)
let noticeTimer: ReturnType<typeof setTimeout> | null = null

function say(text: string, error = false) {
  notice.value = { text, error }
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = null), error ? 5000 : 1800)
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const err = await loadJson(file)
  if (err) say(`Could not load: ${err}`, true)
  else say('Project loaded')
}

async function onCopy() {
  const r = await copyShareLink()
  say(r.message, !r.ok)
}

const btn =
  'rounded-app border border-app-border px-2 py-1 text-xs text-app-muted transition-colors hover:border-app-accent hover:text-app-text disabled:cursor-default disabled:opacity-40 disabled:hover:border-app-border disabled:hover:text-app-muted'
</script>

<template>
  <div class="flex items-center gap-1.5">
    <span
      v-if="notice"
      class="mr-1 text-xs"
      :class="notice.error ? 'text-app-danger' : 'text-app-muted'"
    >
      {{ notice.text }}
    </span>
    <button type="button" :class="btn" :disabled="!canUndo" title="Undo (⌘Z)" @click="undo()">
      ↶ Undo
    </button>
    <button type="button" :class="btn" :disabled="!canRedo" title="Redo (⇧⌘Z)" @click="redo()">
      ↷ Redo
    </button>
    <span class="mx-1 h-4 w-px bg-app-border" />
    <button type="button" :class="btn" title="Download the project as JSON" @click="saveJson()">
      Save JSON
    </button>
    <button
      type="button"
      :class="btn"
      title="Open a saved project JSON"
      @click="fileInput?.click()"
    >
      Load JSON
    </button>
    <input
      ref="fileInput"
      type="file"
      accept="application/json,.json"
      class="hidden"
      @change="onFile"
    />
    <button
      type="button"
      :class="btn"
      title="Copy a link that reproduces this project"
      @click="onCopy()"
    >
      Copy link
    </button>
    <span class="mx-1 h-4 w-px bg-app-border" />
    <button
      type="button"
      :class="btn"
      title="Back to the default project (undoable)"
      @click="projectStore.reset()"
    >
      Reset
    </button>
  </div>
</template>
