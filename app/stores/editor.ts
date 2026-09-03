import { defineStore } from 'pinia'

export type BackgroundMode = 'checker' | 'dark' | 'light'
export type PreviewStatus = 'idle' | 'laying-out' | 'rendering' | 'ready'

/**
 * Transient UI state — NOT persisted into the project JSON.
 */
export const useEditorStore = defineStore('editor', {
  state: () => ({
    zoom: 1,
    backgroundMode: 'checker' as BackgroundMode,
    activePanel: 'text' as string,
    selectedLayer: null as number | null,
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

  actions: {
    setZoom(z: number) {
      this.zoom = z
    },
    setBackgroundMode(m: BackgroundMode) {
      this.backgroundMode = m
    },
    setActivePanel(p: string) {
      this.activePanel = p
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
