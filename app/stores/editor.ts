import { defineStore } from 'pinia'

export type BackgroundMode = 'checker' | 'dark' | 'light'

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
