<script setup lang="ts">
import { ref, computed } from 'vue'
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

// One list of actions feeds both the desktop button row and the mobile menu.
type Action = {
  label: string
  title: string
  disabled?: boolean
  divider?: boolean
  run: () => void
}
const actions = computed<Action[]>(() => [
  { label: '↶ Undo', title: 'Undo (⌘Z)', disabled: !canUndo.value, run: () => undo() },
  { label: '↷ Redo', title: 'Redo (⇧⌘Z)', disabled: !canRedo.value, run: () => redo() },
  {
    label: 'Save JSON',
    title: 'Download the project as JSON',
    divider: true,
    run: () => saveJson(),
  },
  { label: 'Load JSON', title: 'Open a saved project JSON', run: () => fileInput.value?.click() },
  { label: 'Copy link', title: 'Copy a link that reproduces this project', run: () => onCopy() },
  {
    label: 'Reset',
    title: 'Back to the default project (undoable)',
    divider: true,
    run: () => projectStore.reset(),
  },
])

const menuOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)
onClickOutside(menuRef, () => (menuOpen.value = false))

function runFromMenu(a: Action) {
  menuOpen.value = false
  a.run()
}

const btn =
  'rounded-app border border-app-border px-2 py-1 text-xs text-app-muted transition-colors hover:border-app-accent hover:text-app-text disabled:cursor-default disabled:opacity-40 disabled:hover:border-app-border disabled:hover:text-app-muted'
</script>

<template>
  <div class="flex items-center gap-1.5">
    <span
      v-if="notice"
      class="mr-1 truncate text-xs"
      :class="notice.error ? 'text-app-danger' : 'text-app-muted'"
    >
      {{ notice.text }}
    </span>

    <!-- Desktop: flat button row -->
    <div class="hidden items-center gap-1.5 lg:flex">
      <template v-for="a in actions" :key="a.label">
        <span v-if="a.divider" class="mx-1 h-4 w-px bg-app-border" />
        <button type="button" :class="btn" :disabled="a.disabled" :title="a.title" @click="a.run()">
          {{ a.label }}
        </button>
      </template>
    </div>

    <!-- Mobile: everything behind one menu button -->
    <div ref="menuRef" class="relative lg:hidden">
      <button
        type="button"
        class="rounded-app border border-app-border px-3 py-1.5 text-sm text-app-muted transition-colors"
        :class="menuOpen ? 'border-app-accent text-app-text' : ''"
        aria-label="Project menu"
        :aria-expanded="menuOpen"
        @click="menuOpen = !menuOpen"
      >
        ⋯
      </button>
      <div
        v-if="menuOpen"
        class="absolute right-0 top-full z-20 mt-1 flex w-44 flex-col rounded-app border border-app-border bg-app-panel py-1 shadow-lg"
      >
        <template v-for="a in actions" :key="a.label">
          <div v-if="a.divider" class="my-1 h-px bg-app-border" />
          <button
            type="button"
            class="px-3 py-2 text-left text-sm text-app-text transition-colors disabled:opacity-40"
            :disabled="a.disabled"
            :title="a.title"
            @click="runFromMenu(a)"
          >
            {{ a.label }}
          </button>
        </template>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="application/json,.json"
      class="hidden"
      @change="onFile"
    />
  </div>
</template>
