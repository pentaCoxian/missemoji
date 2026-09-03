import { defineStore } from 'pinia'
import type { ExportFormat } from '#core/project/schema'

export type ExportStatus =
  'idle' | 'queued' | 'rendering' | 'encoding' | 'done' | 'error' | 'cancelled'

export interface ExportWarning {
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface ExportResult {
  blobUrl: string
  bytes: number
  format: ExportFormat
}

/**
 * Export job state. Drives useExport, which talks to the encode worker (M7).
 */
export const useExportStore = defineStore('export', {
  state: () => ({
    status: 'idle' as ExportStatus,
    progress: 0,
    estimatedBytes: 0,
    lastResult: null as ExportResult | null,
    warnings: [] as ExportWarning[],
  }),

  getters: {
    isBusy: (s) => s.status === 'queued' || s.status === 'rendering' || s.status === 'encoding',
  },

  actions: {
    begin() {
      this.status = 'queued'
      this.progress = 0
    },
    setStatus(s: ExportStatus) {
      this.status = s
    },
    setProgress(p: number) {
      this.progress = Math.max(0, Math.min(1, p))
    },
    setResult(result: ExportResult) {
      if (this.lastResult) URL.revokeObjectURL(this.lastResult.blobUrl)
      this.lastResult = result
      this.status = 'done'
      this.progress = 1
    },
    setWarnings(warnings: ExportWarning[]) {
      this.warnings = warnings
    },
    setEstimatedBytes(bytes: number) {
      this.estimatedBytes = bytes
    },
    fail() {
      this.status = 'error'
    },
    cancel() {
      this.status = 'cancelled'
    },
  },
})
