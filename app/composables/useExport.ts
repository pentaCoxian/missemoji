import { storeToRefs } from 'pinia'
import { useProjectStore } from '~/stores/project'
import { useExportStore } from '~/stores/export'
import { useEditorStore } from '~/stores/editor'
import { useWorkerClient } from '~/composables/useWorkerClient'
import { solveLayout } from '#core/layout/solve'
import { createSurface } from '#core/render/renderContext'
import { buildFramePlan } from '#core/animation/frames'
import { buildWarnings } from '#core/export/sizeEstimate'
import { computeOvershoot } from '#core/animation/overshoot'
import type { ExportFormat } from '#core/project/schema'

/**
 * Drives an export job through the WORKER pipeline (spec §18): main thread
 * solves layout (cheap), then the render worker rasterizes frames and the
 * encode worker encodes them — the UI never freezes. Falls back to a clear
 * error if a worker dies. Public API (start/cancel) is unchanged from M4.
 */
export function useExport() {
  const projectStore = useProjectStore()
  const exportStore = useExportStore()
  const editor = useEditorStore()
  const { project } = storeToRefs(projectStore)
  const workers = useWorkerClient()

  async function start(format?: ExportFormat) {
    const fmt = format ?? project.value.export.format
    exportStore.begin()
    exportStore.setStatus('rendering')

    try {
      const p = JSON.parse(JSON.stringify(project.value)) // structured-clone-safe copy
      const measure = createSurface(64, 64)
      const layout = solveLayout(measure.ctx, p, computeOvershoot(p))

      const result = await workers.exportViaWorkers(
        p,
        layout,
        {
          format: fmt,
          width: p.export.finalWidth,
          height: p.export.finalHeight,
          loop: p.animation.loop,
          optimizeFor: p.export.optimizeFor,
          apngBackend: editor.apngEngine,
        },
        (prog) => {
          exportStore.setStatus(prog.stage === 'render' ? 'rendering' : 'encoding')
          exportStore.setProgress(prog.fraction)
        },
      )

      const blob = new Blob([result.data], { type: result.mime })
      const url = URL.createObjectURL(blob)
      exportStore.setResult({ blobUrl: url, bytes: result.bytes, format: fmt })

      const frameCount = buildFramePlan(p.animation).length
      exportStore.setWarnings(buildWarnings(p, layout, frameCount, result.bytes))

      triggerDownload(url, suggestFilename(p.text, fmt))
    } catch (e) {
      const msg = (e as Error).message
      if (msg === 'cancelled') {
        exportStore.cancel()
      } else {
        exportStore.fail()
        exportStore.setWarnings([{ level: 'error', message: `Export failed: ${msg}` }])
      }
    }
  }

  function cancel() {
    workers.cancel()
    exportStore.cancel()
  }

  return { start, cancel }
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Misskey emoji names use underscores, not dashes. */
function suggestFilename(text: string, format: ExportFormat): string {
  const base =
    text
      .replace(/\s+/g, '_')
      .replace(/[^\w぀-ヿ一-龯]+/g, '')
      .slice(0, 24) || 'emoji'
  const ext = format === 'apng' ? 'png' : format
  return `${base}.${ext}`
}
