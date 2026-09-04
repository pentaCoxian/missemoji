import { createDefaultProject } from './defaults'
import { pxToFraction, styleBasis } from './units'
import {
  PROJECT_VERSION,
  type AnimDirection,
  type BackgroundSpec,
  type EmojiProject,
  type ExportFormat,
  type FillSpec,
  type GlowSpec,
  type LayoutMode,
  type OptimizeFor,
  type ShadowSpec,
  type StrokeSpec,
} from './schema'

/**
 * Upgrade / sanitize any project-shaped JSON (localStorage, a saved file, a
 * share link, an older schema version) into a valid current EmojiProject.
 *
 * Strategy: start from `createDefaultProject()` and copy over every field that
 * validates; unknown keys are dropped, invalid values fall back to defaults.
 * This is what makes older projects (v1: no direction/hold/phase, an unused
 * `layout.autoLineBreak`, `webp`/`zip` export formats) load cleanly.
 *
 * Version 3 changed style geometry from pixels to fractions of canvas size, so
 * a v1/v2 project's lengths are divided by ITS canvas size — an outline that
 * was 6 px on a 128 px emoji becomes 6/128, which still renders as 6 px there
 * and as 12 px at 256. See core/project/units.ts.
 */
export class ProjectMigrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectMigrationError'
  }
}

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, def: number, min = -Infinity, max = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def
const str = (v: unknown, def: string): string => (typeof v === 'string' ? v : def)
const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def)
const oneOf = <T extends string>(v: unknown, list: readonly T[], def: T): T =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : def
const color = (v: unknown, def: string): string =>
  typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : def

/** Widest style length we accept, as a fraction of canvas size. */
const MAX_LEN = 1

/**
 * Read a style LENGTH: pre-v3 values are pixels (divided by `px`, the project's
 * canvas size), v3+ values are already fractions (`px` is 1).
 */
function len(v: unknown, def: number, px: number, min = 0, max = MAX_LEN): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return def
  return Math.min(max, Math.max(min, pxToFraction(v, px)))
}

const LAYOUT_MODES: LayoutMode[] = ['fit', 'fill', 'safe', 'compact', 'jp-balanced', 'impact']
const DIRECTIONS: AnimDirection[] = ['forward', 'reverse', 'pingpong']
const FORMATS: ExportFormat[] = ['png', 'apng', 'gif']
const OPTIMIZE: OptimizeFor[] = ['quality', 'balanced', 'size']

/** Divisor that turns a legacy pixel length into a fraction (1 when already v3). */
function legacyScale(input: Obj, exp: Obj): number {
  const version = typeof input.version === 'number' ? input.version : 0
  if (version >= 3) return 1
  const size = isObj(input.size) ? input.size : {}
  const basis = styleBasis(
    num(exp.finalWidth, num(size.width, 128, 1), 1),
    num(exp.finalHeight, num(size.height, 128, 1), 1),
  )
  return basis > 0 ? basis : 128
}

function migrateFill(v: unknown, def: FillSpec): FillSpec {
  if (!isObj(v)) return def
  if (v.type === 'solid') return { type: 'solid', color: color(v.color, '#ff5d8f') }
  if (v.type === 'linear-gradient' && Array.isArray(v.stops)) {
    const stops = v.stops
      .filter(isObj)
      .map((s) => ({ position: num(s.position, 0, 0, 1), color: color(s.color, '#ffffff') }))
    if (stops.length >= 2) return { type: 'linear-gradient', stops, angle: num(v.angle, 90) }
  }
  return def
}

function migrateStrokes(v: unknown, def: StrokeSpec[], px: number): StrokeSpec[] {
  if (!Array.isArray(v)) return def
  return v
    .filter(isObj)
    .map((s) => ({ width: len(s.width, def[0]?.width ?? 0, px), color: color(s.color, '#ffffff') }))
}

function migrateShadows(v: unknown, def: ShadowSpec[], px: number): ShadowSpec[] {
  if (!Array.isArray(v)) return def
  return v.filter(isObj).map((s) => ({
    color: color(s.color, '#00000088'),
    blur: len(s.blur, 0, px),
    offsetX: len(s.offsetX, 0, px, -MAX_LEN),
    offsetY: len(s.offsetY, 0, px, -MAX_LEN),
  }))
}

function migrateGlows(v: unknown, def: GlowSpec[], px: number): GlowSpec[] {
  if (!Array.isArray(v)) return def
  return v.filter(isObj).map((g) => ({
    color: color(g.color, '#ffe27a'),
    radius: len(g.radius, 0, px),
    intensity: num(g.intensity, 0.8, 0, 2),
  }))
}

function migrateBackground(v: unknown, px: number): BackgroundSpec | null {
  if (!isObj(v)) return null
  if (v.type === 'solid') return { type: 'solid', color: color(v.color, '#ffffff') }
  if (v.type === 'blob') {
    return {
      type: 'blob',
      color: color(v.color, '#ffffff'),
      radius: len(v.radius, 24 / 128, px),
      padding: len(v.padding, 4 / 128, px),
    }
  }
  return null
}

function migrateParams(v: unknown): EmojiProject['animation']['params'] {
  const out: EmojiProject['animation']['params'] = {}
  if (!isObj(v)) return out
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === 'number' && Number.isFinite(val)) out[k] = val
    else if (typeof val === 'string' || typeof val === 'boolean') out[k] = val
  }
  return out
}

export function migrateProject(input: unknown): EmojiProject {
  if (!isObj(input)) throw new ProjectMigrationError('Project must be a JSON object')
  const d = createDefaultProject()
  const font = isObj(input.font) ? input.font : {}
  const layout = isObj(input.layout) ? input.layout : {}
  const style = isObj(input.style) ? input.style : {}
  const anim = isObj(input.animation) ? input.animation : {}
  const exp = isObj(input.export) ? input.export : {}

  const finalWidth = num(exp.finalWidth, d.export.finalWidth, 16, 1024)
  const finalHeight = num(exp.finalHeight, d.export.finalHeight, 16, 1024)
  // pre-v3 style lengths are pixels on the project's own canvas; v3+ are fractions
  const px = legacyScale(input, exp)

  const variableAxes = isObj(font.variableAxes)
    ? Object.fromEntries(
        Object.entries(font.variableAxes).filter(
          (e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1]),
        ),
      )
    : undefined

  return {
    version: PROJECT_VERSION,
    text: str(input.text, d.text),
    size: { width: finalWidth, height: finalHeight },
    font: {
      family: str(font.family, d.font.family),
      weight: num(font.weight, d.font.weight, 100, 900),
      style: oneOf(font.style, ['normal', 'italic'] as const, d.font.style),
      letterSpacing: len(font.letterSpacing, d.font.letterSpacing, px, -MAX_LEN),
      lineHeight: num(font.lineHeight, d.font.lineHeight, 0.5, 3),
      ...(variableAxes && Object.keys(variableAxes).length ? { variableAxes } : {}),
    },
    layout: {
      mode: oneOf(layout.mode, LAYOUT_MODES, d.layout.mode),
      align: oneOf(layout.align, ['center', 'left', 'right'] as const, d.layout.align),
      verticalAlign: oneOf(
        layout.verticalAlign,
        ['middle', 'top', 'bottom'] as const,
        d.layout.verticalAlign,
      ),
      padding: len(layout.padding, d.layout.padding, px),
      manualLineBreaks: bool(layout.manualLineBreaks, d.layout.manualLineBreaks),
    },
    style: {
      fill: migrateFill(style.fill, d.style.fill),
      strokes: migrateStrokes(style.strokes, d.style.strokes, px),
      shadows: migrateShadows(style.shadows, d.style.shadows, px),
      glows: migrateGlows(style.glows, d.style.glows, px),
      background: migrateBackground(style.background, px),
      decorations: Array.isArray(style.decorations)
        ? style.decorations
            .filter(isObj)
            .filter((dec) => typeof dec.kind === 'string')
            .map((dec) => ({ kind: dec.kind as string, params: migrateParams(dec.params) }))
        : [],
    },
    animation: {
      enabled: bool(anim.enabled, d.animation.enabled),
      preset: str(anim.preset, d.animation.preset),
      durationMs: num(anim.durationMs, d.animation.durationMs, 100, 10000),
      fps: num(anim.fps, d.animation.fps, 1, 60),
      loop: bool(anim.loop, d.animation.loop),
      direction: oneOf(anim.direction, DIRECTIONS, d.animation.direction),
      hold: num(anim.hold, d.animation.hold, 0, 0.5),
      phase: num(anim.phase, d.animation.phase, 0, 1),
      params: migrateParams(anim.params),
    },
    export: {
      format: oneOf(exp.format, FORMATS, d.export.format),
      finalWidth,
      finalHeight,
      renderScale: num(exp.renderScale, d.export.renderScale, 1, 8),
      optimizeFor: oneOf(exp.optimizeFor, OPTIMIZE, d.export.optimizeFor),
    },
  }
}
