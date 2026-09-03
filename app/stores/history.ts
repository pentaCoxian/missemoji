import { defineStore } from 'pinia'
import { createHistory, commit, undo, redo, type HistoryState } from '#core/project/history'

/** Undo / redo stack of serialized project snapshots (see core/project/history). */
export const useHistoryStore = defineStore('history', {
  state: (): HistoryState => createHistory(''),

  getters: {
    canUndo: (s) => s.past.length > 0,
    canRedo: (s) => s.future.length > 0,
  },

  actions: {
    reset(json: string) {
      Object.assign(this, createHistory(json))
    },
    /** Record a snapshot; false when identical to the present. */
    commit(json: string): boolean {
      const next = commit({ past: this.past, present: this.present, future: this.future }, json)
      if (!next) return false
      Object.assign(this, next)
      return true
    },
    undo(): string | null {
      const next = undo({ past: this.past, present: this.present, future: this.future })
      if (!next) return null
      Object.assign(this, next)
      return next.present
    },
    redo(): string | null {
      const next = redo({ past: this.past, present: this.present, future: this.future })
      if (!next) return null
      Object.assign(this, next)
      return next.present
    },
  },
})
