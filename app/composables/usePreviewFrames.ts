import { ref, shallowRef } from 'vue'
import type { FrameSet } from '#core/preview/playback'
import type { LayoutResult } from '#core/layout/types'

export type PreviewStatus = 'idle' | 'solving' | 'rendering' | 'ready' | 'error'

/**
 * Page-wide preview state shared by the stage, the size strip and export:
 * the current worker-rendered frame set, the bitmap on screen, the solved
 * layout and the pipeline status. Module singletons (one preview per page).
 */
const frames = shallowRef<FrameSet | null>(null)
const currentBitmap = shallowRef<ImageBitmap | null>(null)
const layout = shallowRef<LayoutResult | null>(null)
const status = ref<PreviewStatus>('idle')
const error = ref<string | null>(null)
const renderer = ref<'worker' | 'main' | null>(null)

export function usePreviewFrames() {
  return { frames, currentBitmap, layout, status, error, renderer }
}
