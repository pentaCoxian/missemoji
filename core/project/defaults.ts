import { PROJECT_VERSION, type EmojiProject } from './schema'
import { refPxToFraction } from './units'

/**
 * Factory for a fresh EmojiProject.
 *
 * These defaults are a real, hand-tuned emoji rather than a neutral blank: a
 * 256×256 PNG in Impact layout with a gold→charcoal gradient, a thin white
 * outline and a soft drop shadow. Style geometry is stored as a fraction of
 * canvas size; `refPxToFraction` spells those values as the pixel numbers the
 * UI shows at its 128 px reference.
 */
export function createDefaultProject(): EmojiProject {
  return {
    version: PROJECT_VERSION,
    text: '沈黙\nは金',
    size: { width: 256, height: 256 },
    font: {
      family: 'Mochiy Pop P One',
      weight: 400,
      style: 'normal',
      letterSpacing: refPxToFraction(4),
      lineHeight: 1,
    },
    layout: {
      mode: 'impact',
      align: 'center',
      verticalAlign: 'middle',
      padding: 0,
      manualLineBreaks: false,
      justifyLines: false,
    },
    style: {
      fill: {
        type: 'linear-gradient',
        stops: [
          { position: 0, color: '#fffb80' },
          { position: 1, color: '#22212b' },
        ],
        angle: 142,
      },
      strokes: [{ width: refPxToFraction(3), color: '#ffffff' }],
      shadows: [
        {
          color: '#00000088',
          blur: refPxToFraction(6),
          offsetX: 0,
          offsetY: refPxToFraction(4),
        },
      ],
      glows: [],
      background: null,
      decorations: [],
    },
    animation: {
      enabled: false,
      preset: 'pulse',
      durationMs: 1600,
      fps: 24,
      loop: true,
      direction: 'forward',
      hold: 0,
      phase: 0.5,
      params: {},
    },
    export: {
      format: 'png',
      finalWidth: 256,
      finalHeight: 256,
      renderScale: 2,
      optimizeFor: 'quality',
    },
  }
}
