/**
 * Curated, keyless Google Fonts catalog (~40 families) chosen for emoji/stamp
 * legibility, loaded via the keyless CSS2 API (no Developer API key — decision).
 * Grouped for the picker (spec §8). Families must match Google Fonts names
 * exactly so the CSS2 `family=` param resolves.
 */

export type FontGroup =
  | 'recommended'
  | 'jp-rounded'
  | 'jp-display'
  | 'latin-bold'
  | 'latin-condensed'
  | 'handwritten'
  | 'pixel'

export interface FontDescriptor {
  family: string
  group: FontGroup
  /** weights available via CSS2 (used to build the request + weight UI). */
  weights: number[]
  /** true if the family covers Japanese (jp subset). */
  japanese: boolean
  /** true if Google serves real italic faces for this family */
  italic?: boolean
}

export const FONT_GROUP_LABELS: Record<FontGroup, string> = {
  recommended: 'Recommended for emoji',
  'jp-rounded': 'Japanese rounded',
  'jp-display': 'Japanese display',
  'latin-bold': 'Latin bold',
  'latin-condensed': 'Latin condensed',
  handwritten: 'Handwritten',
  pixel: 'Pixel / retro',
}

export const FONT_CATALOG: FontDescriptor[] = [
  // Recommended (great default emoji fonts, JP-capable)
  { family: 'Mochiy Pop One', group: 'recommended', weights: [400], japanese: true },
  { family: 'Mochiy Pop P One', group: 'recommended', weights: [400], japanese: true },
  { family: 'Kosugi Maru', group: 'recommended', weights: [400], japanese: true },
  { family: 'Yusei Magic', group: 'recommended', weights: [400], japanese: true },
  { family: 'RocknRoll One', group: 'recommended', weights: [400], japanese: true },

  // Japanese rounded
  { family: 'Zen Maru Gothic', group: 'jp-rounded', weights: [400, 500, 700, 900], japanese: true },
  { family: 'Kiwi Maru', group: 'jp-rounded', weights: [400, 500], japanese: true },
  {
    family: 'M PLUS Rounded 1c',
    group: 'jp-rounded',
    weights: [400, 700, 800, 900],
    japanese: true,
  },
  {
    family: 'Zen Kaku Gothic New',
    group: 'jp-rounded',
    weights: [400, 500, 700, 900],
    japanese: true,
  },
  { family: 'Kosugi', group: 'jp-rounded', weights: [400], japanese: true },

  // Japanese display
  { family: 'Reggae One', group: 'jp-display', weights: [400], japanese: true },
  { family: 'DotGothic16', group: 'jp-display', weights: [400], japanese: true },
  { family: 'Hachi Maru Pop', group: 'jp-display', weights: [400], japanese: true },
  { family: 'Yuji Syuku', group: 'jp-display', weights: [400], japanese: true },
  { family: 'Stick', group: 'jp-display', weights: [400], japanese: true },
  { family: 'Train One', group: 'jp-display', weights: [400], japanese: true },
  { family: 'Rampart One', group: 'jp-display', weights: [400], japanese: true },
  { family: 'Zen Antique', group: 'jp-display', weights: [400], japanese: true },
  {
    family: 'Shippori Mincho',
    group: 'jp-display',
    weights: [400, 500, 600, 700, 800],
    japanese: true,
  },
  { family: 'Noto Sans JP', group: 'jp-display', weights: [400, 500, 700, 900], japanese: true },
  { family: 'Noto Serif JP', group: 'jp-display', weights: [400, 600, 700, 900], japanese: true },

  // Latin bold
  { family: 'Anton', group: 'latin-bold', weights: [400], japanese: false },
  { family: 'Archivo Black', group: 'latin-bold', weights: [400], japanese: false },
  { family: 'Bungee', group: 'latin-bold', weights: [400], japanese: false },
  { family: 'Luckiest Guy', group: 'latin-bold', weights: [400], japanese: false },
  { family: 'Titan One', group: 'latin-bold', weights: [400], japanese: false },
  { family: 'Fredoka', group: 'latin-bold', weights: [400, 500, 600, 700], japanese: false },
  { family: 'Baloo 2', group: 'latin-bold', weights: [400, 500, 600, 700, 800], japanese: false },

  // Latin condensed
  { family: 'Oswald', group: 'latin-condensed', weights: [400, 500, 600, 700], japanese: false },
  { family: 'Bebas Neue', group: 'latin-condensed', weights: [400], japanese: false },
  {
    family: 'Saira Condensed',
    group: 'latin-condensed',
    weights: [400, 600, 700, 800],
    japanese: false,
    italic: true,
  },

  // Handwritten
  { family: 'Caveat', group: 'handwritten', weights: [400, 600, 700], japanese: false },
  { family: 'Pacifico', group: 'handwritten', weights: [400], japanese: false },
  { family: 'Permanent Marker', group: 'handwritten', weights: [400], japanese: false },
  {
    family: 'Shantell Sans',
    group: 'handwritten',
    weights: [400, 600, 700],
    japanese: false,
    italic: true,
  },
  { family: 'Yomogi', group: 'handwritten', weights: [400], japanese: true },

  // Pixel / retro
  { family: 'Press Start 2P', group: 'pixel', weights: [400], japanese: false },
  { family: 'Pixelify Sans', group: 'pixel', weights: [400, 500, 600, 700], japanese: false },
  { family: 'Silkscreen', group: 'pixel', weights: [400, 700], japanese: false },
  { family: 'VT323', group: 'pixel', weights: [400], japanese: false },
]

const BY_FAMILY = new Map(FONT_CATALOG.map((f) => [f.family, f]))

export function getFontDescriptor(family: string): FontDescriptor | undefined {
  return BY_FAMILY.get(family)
}

/** Group the catalog for the picker, in display order. */
export function groupedCatalog(): { group: FontGroup; fonts: FontDescriptor[] }[] {
  const order: FontGroup[] = [
    'recommended',
    'jp-rounded',
    'jp-display',
    'latin-bold',
    'latin-condensed',
    'handwritten',
    'pixel',
  ]
  return order.map((group) => ({
    group,
    fonts: FONT_CATALOG.filter((f) => f.group === group),
  }))
}
