import { ref, shallowRef, watch, onScopeDispose } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '~/stores/project'
import { useEditorStore } from '~/stores/editor'
import { classifyChange } from '#core/project/dirty'
import { solveLayout } from '#core/layout/solve'
import { renderProjectFrame } from '#core/render/renderProject'
import { createSurface } from '#core/render/renderContext'
import { sampleFrameState } from '#core/animation/sampleAnimation'
import { buildFramePlan } from '#core/animation/frames'
import { computeOvershoot } from '#core/animation/overshoot'
import { buildWarnings } from '#core/export/sizeEstimate'
import { findMissingGlyphs } from '#core/fonts/glyphCheck'
import { segmentGraphemes } from '#core/text/segmentGraphemes'
import type { LayoutResult } from '#core/layout/types'
import type { EmojiProject } from '#core/project/schema'
import { useFontLoading } from '~/composables/useFontLoading'
import { useExportStore } from '~/stores/export'

/**
 * The reactive preview pipeline (spec §18). Watches the project, classifies
 * each change, and re-runs only the needed stages (layout / render). Renders
 * the current frame onto a provided visible canvas. Animation playback advances
 * frames via rAF without re-laying-out.
 */
export function usePreviewPipeline(canvasRef: Ref<HTMLCanvasElement | null>) {
  const projectStore = useProjectStore()
  const editor = useEditorStore()
  const exportStore = useExportStore()
  const { project } = storeToRefs(projectStore)

  // Non-reactive caches.
  const measureSurface = createSurface(64, 64)
  const layout = shallowRef<LayoutResult | null>(null)
  let prevSnapshot: EmojiProject = JSON.parse(JSON.stringify(project.value))
  let rafId = 0

  const isReady = ref(false)

  // Font loading re-runs layout when the selected font finishes loading.
  const { ensure: ensureFont } = useFontLoading(() => {
    solve()
    renderToCanvas()
  })

  function solve() {
    editor.setPreviewStatus('laying-out')
    const p = project.value
    // Reserve safe-box room for the animation's measured reach so motion never clips.
    layout.value = solveLayout(measureSurface.ctx, p, computeOvershoot(p))
    // keep frame count in sync for playback
    const plan = buildFramePlan(p.animation)
    editor.setFrameCount(plan.length)

    // Live readability/size warnings (estimate only; refined on export).
    const missing = findMissingGlyphs(measureSurface.ctx, p.font, segmentGraphemes(p.text))
    exportStore.setWarnings(buildWarnings(p, layout.value, plan.length, undefined, missing))
  }

  function renderToCanvas() {
    const canvas = canvasRef.value
    if (!canvas || !layout.value) return
    editor.setPreviewStatus('rendering')

    const p = project.value
    const frameState = p.animation.enabled ? sampleCurrent(p) : undefined

    const frame = renderProjectFrame(p, {
      layout: layout.value,
      frame: frameState,
    })

    // Blit the RGBA frame onto the visible canvas at final size.
    canvas.width = frame.width
    canvas.height = frame.height
    const ctx = canvas.getContext('2d')!
    const img = new ImageData(frame.rgba, frame.width, frame.height)
    ctx.putImageData(img, 0, 0)

    // Publish a data URL for the actual-size preview strip (cheap at <=256px).
    editor.setPreviewDataUrl(canvas.toDataURL('image/png'))

    editor.setPreviewStatus('ready')
    isReady.value = true
  }

  function sampleCurrent(p: EmojiProject) {
    const plan = buildFramePlan(p.animation)
    const idx = Math.min(editor.playback.currentFrame, plan.length - 1)
    const progress = plan[idx]?.progress ?? 0
    return sampleFrameState(p.animation, progress)
  }

  // Animation playback loop. Advance frames on a TIME basis (respecting each
  // frame's delayMs) rather than once per rAF — otherwise a 12-frame loop plays
  // in ~0.2s on a 60Hz display (the "too fast / jittery" bug) instead of the
  // intended duration. This also makes the preview speed match the exported
  // file and stay identical at 128 and 256.
  let lastTs = 0
  let accumMs = 0
  function tick(ts: number) {
    if (project.value.animation.enabled && editor.playback.playing) {
      if (lastTs === 0) lastTs = ts
      accumMs += ts - lastTs
      lastTs = ts

      const plan = buildFramePlan(project.value.animation)
      const cur = Math.min(editor.playback.currentFrame, plan.length - 1)
      const frameDelay = plan[cur]?.delayMs ?? 1000 / 12

      if (accumMs >= frameDelay) {
        // step as many frames as elapsed (handles slow tabs without speeding up)
        const steps = Math.floor(accumMs / frameDelay)
        accumMs -= steps * frameDelay
        const count = Math.max(1, editor.playback.frameCount)
        let next = cur + steps
        if (project.value.animation.loop) {
          next %= count
        } else if (next >= count) {
          // play once: park on the last frame
          next = count - 1
          editor.setPlaying(false)
        }
        editor.setCurrentFrame(next)
        renderToCanvas()
      }
    } else {
      lastTs = ts
      accumMs = 0
    }
    rafId = requestAnimationFrame(tick)
  }

  // Initial solve + render. Kick off font loading; layout re-runs when ready.
  function init() {
    solve()
    renderToCanvas()
    void ensureFont()
    rafId = requestAnimationFrame(tick)
  }

  // React to project changes with stage-appropriate recompute. The full font
  // family is loaded once on family change (useFontLoading), so text edits need
  // no re-fetch — just re-solve/re-render.
  watch(
    project,
    (next) => {
      const flags = classifyChange(prevSnapshot, next)
      prevSnapshot = JSON.parse(JSON.stringify(next))
      if (flags.layout) solve()
      if (flags.layout || flags.render || flags.frames) renderToCanvas()
    },
    { deep: true },
  )

  // Pressing play while parked on the last frame (loop off) restarts the run.
  watch(
    () => editor.playback.playing,
    (playing) => {
      if (
        playing &&
        !project.value.animation.loop &&
        editor.playback.currentFrame >= editor.playback.frameCount - 1
      ) {
        editor.setCurrentFrame(0)
      }
    },
  )

  // Redraw when the user scrubs frames while paused.
  watch(
    () => editor.playback.currentFrame,
    () => {
      if (!editor.playback.playing) renderToCanvas()
    },
  )

  onScopeDispose(() => {
    if (rafId) cancelAnimationFrame(rafId)
  })

  return { init, solve, renderToCanvas, layout, isReady }
}
