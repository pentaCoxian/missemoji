import { computed, nextTick, watch } from 'vue'
import { useProjectStore } from '~/stores/project'
import { useHistoryStore } from '~/stores/history'

/**
 * Undo / redo for the project. Every edit is committed on a 300 ms trailing
 * edge so a slider drag collapses into one step. Restoring replaces the whole
 * project in one assignment (the preview watcher fires once) and is excluded
 * from tracking. Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z and Ctrl+Y are bound globally
 * except while typing in a field.
 */
const COMMIT_DEBOUNCE_MS = 300

let installed = false
let restoring = false
let timer: ReturnType<typeof setTimeout> | null = null

function snapshot(): string {
  return JSON.stringify(useProjectStore().project)
}

function flush() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  useHistoryStore().commit(snapshot())
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
}

function onKeydown(e: KeyboardEvent) {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return
  if (isEditableTarget(e.target)) return
  const key = e.key.toLowerCase()
  if (key === 'z') {
    e.preventDefault()
    if (e.shiftKey) redoProject()
    else undoProject()
  } else if (key === 'y' && e.ctrlKey) {
    e.preventDefault()
    redoProject()
  }
}

function restore(json: string | null) {
  if (!json) return
  restoring = true
  useProjectStore().loadProject(JSON.parse(json))
  void nextTick(() => {
    restoring = false
  })
}

export function undoProject() {
  flush()
  restore(useHistoryStore().undo())
}

export function redoProject() {
  flush()
  restore(useHistoryStore().redo())
}

/** Start tracking (once per page). Call after the initial project is loaded. */
export function installHistoryTracking() {
  if (installed) return
  installed = true
  const projectStore = useProjectStore()
  useHistoryStore().reset(snapshot())
  watch(
    () => projectStore.project,
    () => {
      if (restoring) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, COMMIT_DEBOUNCE_MS)
    },
    { deep: true },
  )
  window.addEventListener('keydown', onKeydown)
}

export function useHistory() {
  const history = useHistoryStore()
  return {
    canUndo: computed(() => history.canUndo),
    canRedo: computed(() => history.canRedo),
    undo: undoProject,
    redo: redoProject,
  }
}
