import { defineStore } from 'pinia'

export type BackgroundMode = 'checker' | 'dark' | 'light'
export type PreviewStatus = 'idle' | 'laying-out' | 'rendering' | 'ready'

/** Tailwind classes for each preview backdrop (shared by stage + size strip). */
const BACKGROUND_CLASS: Record<BackgroundMode, string> = {
  checker: 'checkerboard',
  dark: 'bg-[#15171c]',
  light: 'bg-[#f4f5f7]',
}

/**
 * Transient UI state — NOT persisted into the project JSON.
 */
export const useEditorStore = defineStore('editor', {
  state: () => ({
    backgroundMode: 'checker' as BackgroundMode,
    previewStatus: 'idle' as PreviewStatus,
    /** data URL of the current rendered frame, for actual-size preview strip */
    previewDataUrl: '' as string,
    /** APNG encoder backend: 'upng' (default) or 'wasm' (Rust→WASM) */
    apngEngine: 'upng' as 'upng' | 'wasm',
    playback: {
      playing: true,
      currentFrame: 0,
      frameCount: 1,
    },
  }),

  getters: {
    backgroundClass: (s): string => BACKGROUND_CLASS[s.backgroundMode],
  },

  actions: {
    setBackgroundMode(m: BackgroundMode) {
      this.backgroundMode = m
    },
    setPreviewStatus(s: PreviewStatus) {
      this.previewStatus = s
    },
    setPreviewDataUrl(url: string) {
      this.previewDataUrl = url
    },
    setApngEngine(e: 'upng' | 'wasm') {
      this.apngEngine = e
    },
    setPlaying(v: boolean) {
      this.playback.playing = v
    },
    setCurrentFrame(i: number) {
      this.playback.currentFrame = i
    },
    setFrameCount(n: number) {
      this.playback.frameCount = n
      if (this.playback.currentFrame >= n) this.playback.currentFrame = 0
    },
  },
})
