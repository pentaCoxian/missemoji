import type { EmojiProject } from './schema'

/**
 * Factory for a fresh EmojiProject. Defaults mirror the spec's APNG defaults
 * (spec §12): 128×128 final, 4× render scale, 12fps / 1000ms, transparent bg.
 */
export function createDefaultProject(): EmojiProject {
  return {
    version: 1,
    text: 'やった！',
    size: { width: 128, height: 128 },
    font: {
      family: 'Mochiy Pop One',
      weight: 400,
      style: 'normal',
      letterSpacing: 0,
      lineHeight: 1.05,
    },
    layout: {
      mode: 'fit',
      align: 'center',
      verticalAlign: 'middle',
      padding: 4,
      manualLineBreaks: false,
    },
    style: {
      fill: { type: 'solid', color: '#ff5d8f' },
      strokes: [{ width: 6, color: '#ffffff' }],
      shadows: [],
      glows: [],
      background: null,
      decorations: [],
    },
    animation: {
      enabled: false,
      preset: 'pulse',
      // Calmer, slower default loop than the spec's 1000ms for a smoother feel.
      durationMs: 1400,
      fps: 12,
      loop: true,
      params: {},
    },
    export: {
      format: 'apng',
      finalWidth: 128,
      finalHeight: 128,
      renderScale: 4,
      optimizeFor: 'balanced',
    },
  }
}
