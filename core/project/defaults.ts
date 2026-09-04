import { PROJECT_VERSION, type EmojiProject } from './schema'
import { refPxToFraction } from './units'

/**
 * Factory for a fresh EmojiProject. Defaults mirror the spec's APNG defaults
 * (spec §12): 128×128 final, 4× render scale, 12fps / 1000ms, transparent bg.
 *
 * Style geometry is stored as a fraction of canvas size; `refPxToFraction`
 * spells the defaults as the pixel values the UI shows at 128 px.
 */
export function createDefaultProject(): EmojiProject {
  return {
    version: PROJECT_VERSION,
    text: 'やった！',
    size: { width: 128, height: 128 },
    font: {
      family: 'Mochiy Pop One',
      weight: 400,
      style: 'normal',
      letterSpacing: refPxToFraction(0),
      lineHeight: 1.05,
    },
    layout: {
      mode: 'fit',
      align: 'center',
      verticalAlign: 'middle',
      padding: refPxToFraction(4),
      manualLineBreaks: false,
    },
    style: {
      fill: { type: 'solid', color: '#ff5d8f' },
      strokes: [{ width: refPxToFraction(6), color: '#ffffff' }],
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
      direction: 'forward',
      hold: 0,
      phase: 0,
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
