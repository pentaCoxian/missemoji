import { storeToRefs } from 'pinia'
import { useProjectStore } from '~/stores/project'
import { useExportStore } from '~/stores/export'
import { useEditorStore } from '~/stores/editor'
import { usePreviewFrames } from '~/composables/usePreviewFrames'
import { resolveRenderClient, noteRenderWorkerCrash } from '~/composables/useRenderWorker'
import { encodeInWorker } from '~/composables/useEncodeWorker'
import { collectFontFaces } from '~/utils/fontFaces'
import { WorkerCrashedError } from '~/utils/workerRpc'
import { solveLayout } from '#core/layout/solve'
import { createSurface } from '#core/render/renderContext'
import { computeOvershoot } from '#core/animation/overshoot'
import { buildWarnings } from '#core/export/sizeEstimate'
import type { ExportFormat } from '#core/project/schema'
import type { TransferableFrame } from '#workers/protocol'

/**
 * Drives an export job: the same render client as the preview rasterizes the
 * frames (so the file matches what is on screen, fonts included), then the
 * encode worker turns them into bytes — the UI never freezes. Cancellation
 * and worker crashes surface as status / warnings instead of hanging.
 */
export function useExport() {
  const projectStore = useProjectStore()
  const exportStore = useExportStore()
  const editor = useEditorStore()
  const { project } = storeToRefs(projectStore)
  const preview = usePreviewFrames()

  let active: { cancel: () => void } | null = null

  async function start(format?: ExportFormat) {
    const fmt = format ?? project.value.export.format
    exportStore.begin()
    exportStore.setStatus('rendering')

    try {
      const p = projectStore.serialize()
      const { faces, needsFaces, hasFaces } = collectFontFaces(p)
      const client = await resolveRenderClient(needsFaces, hasFaces)
      // Reuse the preview's layout (identical project) so the export is
      // pixel-for-pixel what the stage shows; solve only if it is missing.
      const layout =
        preview.layout.value ?? solveLayout(createSurface(64, 64).ctx, p, computeOvershoot(p))

      const frames: TransferableFrame[] = []
      const job = client.render(
        { project: p, layout, faces, output: 'rgba' },
        {
          onFrame: (f) => frames.push(f),
          onProgress: (stage, done, total) => {
            if (stage === 'render') exportStore.setProgress((done / total) * 0.5)
          },
        },
      )
      active = job
      const rendered = await job.done
      frames.sort((a, b) => a.index - b.index)

      exportStore.setStatus('encoding')
      const enc = encodeInWorker(
        frames,
        {
          format: fmt,
          width: p.export.finalWidth,
          height: p.export.finalHeight,
          loop: p.animation.loop,
          optimizeFor: p.export.optimizeFor,
          apngBackend: editor.apngEngine,
        },
        (fraction) => exportStore.setProgress(0.5 + fraction * 0.5),
      )
      active = enc
      const result = await enc.done

      const blob = new Blob([result.data], { type: result.mime })
      const url = URL.createObjectURL(blob)
      const filename = suggestFilename(p.text, fmt)
      exportStore.setResult({
        blobUrl: url,
        bytes: result.bytes,
        format: fmt,
        filename,
        backendUsed: result.backendUsed,
      })
      exportStore.setWarnings(buildWarnings(p, layout, rendered.count, result.bytes))
      triggerDownload(url, filename)
    } catch (e) {
      const msg = (e as Error).message
      if (msg === 'cancelled') {
        exportStore.cancel()
      } else {
        if (e instanceof WorkerCrashedError) noteRenderWorkerCrash()
        exportStore.fail()
        exportStore.setWarnings([{ level: 'error', message: `Export failed: ${msg}` }])
      }
    } finally {
      active = null
    }
  }

  function cancel() {
    active?.cancel()
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
