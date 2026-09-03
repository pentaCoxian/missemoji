import { watch, onScopeDispose, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useDebounceFn } from '@vueuse/core'
import { useProjectStore } from '~/stores/project'
import { useEditorStore } from '~/stores/editor'
import { useExportStore } from '~/stores/export'
import { useFontLoading } from '~/composables/useFontLoading'
import { usePreviewFrames } from '~/composables/usePreviewFrames'
import { resolveRenderClient, noteRenderWorkerCrash } from '~/composables/useRenderWorker'
import type { RenderJob } from '~/composables/renderClient'
import { collectFontFaces } from '~/utils/fontFaces'
import { WorkerCrashedError } from '~/utils/workerRpc'
import { classifyChange } from '#core/project/dirty'
import { solveLayout } from '#core/layout/solve'
import { renderProjectFrame } from '#core/render/renderProject'
import { createSurface } from '#core/render/renderContext'
import { sampleFrameState } from '#core/animation/sampleAnimation'
import { buildFramePlan } from '#core/animation/frames'
import { computeOvershoot } from '#core/animation/overshoot'
import { buildWarnings, estimateBytesFromStats } from '#core/export/sizeEstimate'
import { findMissingGlyphs } from '#core/fonts/glyphCheck'
import { segmentGraphemes } from '#core/text/segmentGraphemes'
import {
  advancePlayhead,
  createGenerationGate,
  installFrameSet,
  type FrameSet,
  type PlayheadState,
} from '#core/preview/playback'
import type { FrameStats } from '#core/types'
import type { EmojiProject } from '#core/project/schema'

/**
 * The reactive preview pipeline (spec §18).
 *
 * Layout is solved on the main thread (cheap; fonts live in document.fonts).
 * Frames are rendered by the render client — normally the worker, through the
 * SAME frame sequence export uses — into a cache of ImageBitmaps; playback is
 * then one drawImage per tick. Requests are debounced and carry a generation
 * so results of superseded edits are dropped (stale-while-revalidate: the old
 * set keeps playing until the new one is complete). Only the very first paint
 * renders frame 0 synchronously on the main thread.
 */
export function usePreviewPipeline(canvasRef: Ref<HTMLCanvasElement | null>) {
  const projectStore = useProjectStore()
  const editor = useEditorStore()
  const exportStore = useExportStore()
  const { project } = storeToRefs(projectStore)
  const pf = usePreviewFrames()

  const measureSurface = createSurface(64, 64)
  const gate = createGenerationGate()
  let prevSnapshot: EmojiProject = projectStore.serialize()
  let activeJob: RenderJob | null = null
  let missingGlyphs: string[] = []

  const { ensure: ensureFont } = useFontLoading(() => {
    solve()
    requestSet()
  })

  // ---- layout ----------------------------------------------------------

  function solve() {
    pf.status.value = 'solving'
    const p = project.value
    pf.layout.value = solveLayout(measureSurface.ctx, p, computeOvershoot(p))
    const plan = buildFramePlan(p.animation)
    editor.setFrameCount(plan.length)
    missingGlyphs = findMissingGlyphs(measureSurface.ctx, p.font, segmentGraphemes(p.text))
    exportStore.setWarnings(
      buildWarnings(p, pf.layout.value, plan.length, undefined, missingGlyphs),
    )
  }

  // ---- drawing ---------------------------------------------------------

  function drawBitmap(bmp: ImageBitmap) {
    const canvas = canvasRef.value
    if (!canvas) return
    if (canvas.width !== bmp.width || canvas.height !== bmp.height) {
      canvas.width = bmp.width
      canvas.height = bmp.height
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bmp, 0, 0)
    pf.currentBitmap.value = bmp
  }

  function drawFrameIndex(i: number) {
    const set = pf.frames.value
    if (!set || set.bitmaps.length === 0) return
    const bmp = set.bitmaps[Math.min(Math.max(0, i), set.bitmaps.length - 1)]
    if (bmp) drawBitmap(bmp)
  }

  /** Synchronous first paint so the stage is never blank while the worker boots. */
  function coldStart() {
    const canvas = canvasRef.value
    const layout = pf.layout.value
    if (!canvas || !layout) return
    const p = project.value
    const frame = renderProjectFrame(p, {
      layout,
      frame: p.animation.enabled ? sampleFrameState(p.animation, 0) : undefined,
    })
    canvas.width = frame.width
    canvas.height = frame.height
    const img = new ImageData(frame.rgba, frame.width, frame.height)
    canvas.getContext('2d')?.putImageData(img, 0, 0)
    void createImageBitmap(img).then((bmp) => {
      if (!pf.frames.value) pf.currentBitmap.value = bmp
      else bmp.close()
    })
  }

  // ---- frame set requests ---------------------------------------------

  async function doRequestSet() {
    const layout = pf.layout.value
    if (!layout) return
    const p = projectStore.serialize()
    const gen = gate.next()
    activeJob?.cancel()
    activeJob = null

    const { faces, needsFaces, hasFaces } = collectFontFaces(p)
    const client = await resolveRenderClient(needsFaces, hasFaces)
    if (!gate.isCurrent(gen)) return
    pf.renderer.value = client.kind
    pf.status.value = 'rendering'

    const bitmaps: ImageBitmap[] = []
    const delays: number[] = []
    const stats: FrameStats[] = []
    const job = client.render(
      { project: p, layout, faces, output: 'bitmap' },
      {
        onBitmap(index, _total, bmp, delayMs, st) {
          if (!gate.isCurrent(gen)) {
            bmp.close()
            return
          }
          bitmaps[index] = bmp
          delays[index] = delayMs
          stats[index] = st
          // nothing cached yet: show the first frame as soon as it exists
          if (!pf.frames.value && index === 0) drawBitmap(bmp)
        },
      },
    )
    activeJob = job
    try {
      await job.done
      if (!gate.isCurrent(gen)) {
        for (const b of bitmaps) b?.close()
        return
      }
      const set: FrameSet = {
        generation: gen,
        bitmaps,
        delays,
        width: p.export.finalWidth,
        height: p.export.finalHeight,
        stats,
      }
      pf.frames.value = installFrameSet(pf.frames.value, set)
      editor.setFrameCount(bitmaps.length)
      exportStore.setWarnings(
        buildWarnings(p, layout, bitmaps.length, estimateBytesFromStats(p, stats), missingGlyphs),
      )
      pf.status.value = 'ready'
      pf.error.value = null
      if (!editor.playback.playing || bitmaps.length <= 1) {
        drawFrameIndex(editor.playback.currentFrame)
      }
    } catch (err) {
      for (const b of bitmaps) b?.close()
      const message = (err as Error).message
      if (message === 'cancelled' || !gate.isCurrent(gen)) return
      if (err instanceof WorkerCrashedError) noteRenderWorkerCrash()
      pf.status.value = 'error'
      pf.error.value = message
    } finally {
      if (activeJob === job) activeJob = null
    }
  }

  const requestSet = useDebounceFn(() => void doRequestSet(), 60)

  // ---- playback --------------------------------------------------------

  let rafId = 0
  let lastTs = 0
  let head: PlayheadState = { index: 0, accumMs: 0 }

  function tick(ts: number) {
    rafId = 0
    const set = pf.frames.value
    if (!set || set.bitmaps.length <= 1 || !editor.playback.playing) return
    const elapsed = ts - lastTs
    lastTs = ts
    const step = advancePlayhead(head, elapsed, set.delays, project.value.animation.loop)
    head = { index: step.index, accumMs: step.accumMs }
    if (step.index !== editor.playback.currentFrame) {
      editor.setCurrentFrame(step.index)
      drawFrameIndex(step.index)
    }
    if (step.ended) {
      editor.setPlaying(false)
      return
    }
    rafId = requestAnimationFrame(tick)
  }

  function startLoop() {
    if (rafId) return
    lastTs = performance.now()
    head = { index: editor.playback.currentFrame, accumMs: 0 }
    rafId = requestAnimationFrame(tick)
  }

  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  }

  watch(
    [() => editor.playback.playing, pf.frames],
    ([playing, set]) => {
      const animated = !!set && set.bitmaps.length > 1
      if (playing && animated) {
        // pressing play while parked on the last frame (loop off) restarts
        if (
          !project.value.animation.loop &&
          editor.playback.currentFrame >= editor.playback.frameCount - 1
        ) {
          editor.setCurrentFrame(0)
          head = { index: 0, accumMs: 0 }
        }
        startLoop()
      } else {
        stopLoop()
      }
    },
    { immediate: true },
  )

  // Redraw when the user scrubs while paused.
  watch(
    () => editor.playback.currentFrame,
    (i) => {
      if (!editor.playback.playing) drawFrameIndex(i)
    },
  )

  // ---- project changes -------------------------------------------------

  watch(
    project,
    (next) => {
      const flags = classifyChange(prevSnapshot, next)
      prevSnapshot = projectStore.serialize()
      if (flags.layout) solve()
      if (flags.layout || flags.render || flags.frames) requestSet()
    },
    { deep: true },
  )

  function init() {
    solve()
    coldStart()
    requestSet()
    void ensureFont()
  }

  onScopeDispose(() => {
    stopLoop()
    activeJob?.cancel()
  })

  return { init, solve }
}
