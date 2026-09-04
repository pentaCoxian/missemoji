import { defineStore } from 'pinia'

export type BackgroundMode = 'checker' | 'dark' | 'light'

/** Tailwind classes for each preview backdrop (shared by stage + size strip). */
const BACKGROUND_CLASS: Record<BackgroundMode, string> = {
  checker: 'checkerboard',
  // Misskey's own page backgrounds (d-dark / l-light `bg`), so the preview
  // shows the emoji against what a timeline actually looks like.
  dark: 'bg-[#232323]',
  light: 'bg-[#f9f9f9]',
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
    /** batch export: one emoji per line of batchText, styled like the project */
    batchMode: false,
    batchText: '',
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
    setBatchMode(v: boolean) {
      this.batchMode = v
    },
    setBatchText(text: string) {
      this.batchText = text
    },
    setFrameCount(n: number) {
      this.playback.frameCount = n
      if (this.playback.currentFrame >= n) this.playback.currentFrame = 0
    },
  },
})
