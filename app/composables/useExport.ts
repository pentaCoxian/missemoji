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
import { suggestFilename, uniqueNames } from '#core/export/filename'
import { zipFiles, type ZipEntry } from '#core/export/encodeZip'
import { parseBatchLines } from '#core/export/batch'
import { triggerDownload } from '~/utils/download'
import type { EmojiProject, ExportFormat } from '#core/project/schema'
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

  interface Produced {
    data: ArrayBuffer
    bytes: number
    mime: string
    backendUsed: string
    frameCount: number
    layout: ReturnType<typeof solveLayout>
  }

  /**
   * Render + encode one project. `progress` receives 0..1 for this file. The
   * preview's layout is reused when it was solved for this exact project so
   * the file is pixel-for-pixel what the stage shows.
   */
  async function produce(
    p: EmojiProject,
    fmt: ExportFormat,
    progress: (fraction: number) => void,
    reusePreviewLayout: boolean,
  ): Promise<Produced> {
    const { faces, needsFaces, hasFaces } = collectFontFaces(p)
    const client = await resolveRenderClient(needsFaces, hasFaces)
    const layout =
      (reusePreviewLayout ? preview.layout.value : null) ??
      solveLayout(createSurface(64, 64).ctx, p, computeOvershoot(p))

    exportStore.setStatus('rendering')
    const frames: TransferableFrame[] = []
    const job = client.render(
      { project: p, layout, faces, output: 'rgba' },
      {
        onFrame: (f) => frames.push(f),
        onProgress: (stage, done, total) => {
          if (stage === 'render') progress((done / total) * 0.5)
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
      (fraction) => progress(0.5 + fraction * 0.5),
    )
    active = enc
    const result = await enc.done
    return {
      data: result.data,
      bytes: result.bytes,
      mime: result.mime,
      backendUsed: result.backendUsed,
      frameCount: rendered.count,
      layout,
    }
  }

  function handleFailure(e: unknown) {
    const msg = (e as Error).message
    if (msg === 'cancelled') {
      exportStore.cancel()
      return
    }
    if (e instanceof WorkerCrashedError) noteRenderWorkerCrash()
    exportStore.fail()
    exportStore.setWarnings([{ level: 'error', message: `Export failed: ${msg}` }])
  }

  async function start(format?: ExportFormat) {
    const fmt = format ?? project.value.export.format
    exportStore.begin()
    try {
      const p = projectStore.serialize()
      const out = await produce(p, fmt, (f) => exportStore.setProgress(f), true)
      const blob = new Blob([out.data], { type: out.mime })
      const url = URL.createObjectURL(blob)
      const filename = suggestFilename(p.text, fmt)
      exportStore.setResult({
        blobUrl: url,
        bytes: out.bytes,
        format: fmt,
        filename,
        backendUsed: out.backendUsed,
      })
      exportStore.setWarnings(buildWarnings(p, out.layout, out.frameCount, out.bytes))
      triggerDownload(url, filename)
    } catch (e) {
      handleFailure(e)
    } finally {
      active = null
    }
  }

  /** One emoji per line of `text`, all styled like the current project, zipped. */
  async function startBatch(text: string) {
    const fmt = project.value.export.format
    const lines = parseBatchLines(text)
    if (lines.length === 0) return
    exportStore.begin()
    exportStore.beginBatch(lines.length)
    try {
      const entries: ZipEntry[] = []
      let totalBytes = 0
      for (let i = 0; i < lines.length; i++) {
        const p = projectStore.serialize()
        p.text = lines[i]!
        const out = await produce(
          p,
          fmt,
          (f) => exportStore.setProgress((i + f) / lines.length),
          false,
        )
        entries.push({ name: suggestFilename(p.text, fmt), data: new Uint8Array(out.data) })
        totalBytes += out.bytes
        exportStore.setBatchDone(i + 1)
      }
      const names = uniqueNames(entries.map((e) => e.name))
      entries.forEach((e, i) => (e.name = names[i]!))
      const zip = zipFiles(entries)
      const blob = new Blob([zip], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const filename = 'missemoji_batch.zip'
      exportStore.setResult({ blobUrl: url, bytes: zip.byteLength, format: fmt, filename })
      exportStore.setWarnings([
        {
          level: 'info',
          message: `${entries.length} emojis zipped (${Math.round(totalBytes / 1024)}KB of ${fmt.toUpperCase()}).`,
        },
      ])
      triggerDownload(url, filename)
    } catch (e) {
      handleFailure(e)
    } finally {
      active = null
    }
  }

  function cancel() {
    active?.cancel()
    exportStore.cancel()
  }

  return { start, startBatch, cancel }
}
