import { defineStore } from 'pinia'
import { createDefaultProject } from '#core/project/defaults'
import { migrateProject } from '#core/project/migrate'
import { getFontDescriptor } from '#core/fonts/catalog'
import type {
  Align,
  AnimDirection,
  BackgroundSpec,
  EmojiProject,
  ExportFormat,
  FillSpec,
  GlowSpec,
  LayoutMode,
  OptimizeFor,
  ShadowSpec,
  StrokeSpec,
  VerticalAlign,
} from '#core/project/schema'

/**
 * Single source of truth for the emoji artifact. Setters are granular and
 * typed (not a blob `patch`) so the dirty-tracker (core/project/dirty.ts) can
 * classify changes cheaply.
 */
export const useProjectStore = defineStore('project', {
  state: () => ({
    project: createDefaultProject(),
  }),

  getters: {
    isAnimated: (s): boolean => s.project.animation.enabled,
  },

  actions: {
    // --- text ---
    setText(text: string) {
      this.project.text = text
    },

    // --- font ---
    setFontFamily(family: string) {
      this.project.font.family = family
      // Snap the current weight to one this family actually offers, so the
      // render weight matches the loaded face (no faux-bold / fallback).
      const desc = getFontDescriptor(family)
      // Only families with real italic faces keep an italic style.
      if (desc && !desc.italic) this.project.font.style = 'normal'
      if (desc && !desc.weights.includes(this.project.font.weight)) {
        const want = this.project.font.weight
        this.project.font.weight = desc.weights.reduce(
          (best, w) => (Math.abs(w - want) < Math.abs(best - want) ? w : best),
          desc.weights[0] ?? 400,
        )
      }
    },
    setFontWeight(weight: number) {
      this.project.font.weight = weight
    },
    setFontStyle(style: 'normal' | 'italic') {
      this.project.font.style = style
    },
    setLetterSpacing(v: number) {
      this.project.font.letterSpacing = v
    },
    setLineHeight(v: number) {
      this.project.font.lineHeight = v
    },

    // --- layout ---
    setLayoutMode(mode: LayoutMode) {
      this.project.layout.mode = mode
    },
    setAlign(align: Align) {
      this.project.layout.align = align
    },
    setVerticalAlign(v: VerticalAlign) {
      this.project.layout.verticalAlign = v
    },
    setPadding(v: number) {
      this.project.layout.padding = v
    },
    setManualLineBreaks(v: boolean) {
      this.project.layout.manualLineBreaks = v
    },

    // --- style: fill ---
    setFill(fill: FillSpec) {
      this.project.style.fill = fill
    },

    // --- style: strokes ---
    addStroke(stroke: StrokeSpec) {
      this.project.style.strokes.push(stroke)
    },
    updateStroke(i: number, stroke: Partial<StrokeSpec>) {
      const s = this.project.style.strokes[i]
      if (s) Object.assign(s, stroke)
    },
    removeStroke(i: number) {
      this.project.style.strokes.splice(i, 1)
    },

    // --- style: shadows ---
    addShadow(shadow: ShadowSpec) {
      this.project.style.shadows.push(shadow)
    },
    updateShadow(i: number, shadow: Partial<ShadowSpec>) {
      const s = this.project.style.shadows[i]
      if (s) Object.assign(s, shadow)
    },
    removeShadow(i: number) {
      this.project.style.shadows.splice(i, 1)
    },

    // --- style: glows ---
    addGlow(glow: GlowSpec) {
      this.project.style.glows.push(glow)
    },
    updateGlow(i: number, glow: Partial<GlowSpec>) {
      const g = this.project.style.glows[i]
      if (g) Object.assign(g, glow)
    },
    removeGlow(i: number) {
      this.project.style.glows.splice(i, 1)
    },

    // --- style: background ---
    setBackground(bg: BackgroundSpec | null) {
      this.project.style.background = bg
    },

    // --- animation ---
    setAnimationEnabled(v: boolean) {
      this.project.animation.enabled = v
    },
    setPreset(preset: string) {
      this.project.animation.preset = preset
    },
    setDuration(ms: number) {
      this.project.animation.durationMs = ms
    },
    setFps(fps: number) {
      this.project.animation.fps = fps
    },
    setLoop(v: boolean) {
      this.project.animation.loop = v
    },
    setDirection(d: AnimDirection) {
      this.project.animation.direction = d
    },
    setHold(v: number) {
      this.project.animation.hold = v
    },
    setPhase(v: number) {
      this.project.animation.phase = v
    },
    setAnimParam(key: string, value: number | string | boolean) {
      this.project.animation.params = {
        ...this.project.animation.params,
        [key]: value,
      }
    },

    // --- export ---
    setExportFormat(format: ExportFormat) {
      this.project.export.format = format
    },
    setFinalSize(width: number, height: number) {
      this.project.export.finalWidth = width
      this.project.export.finalHeight = height
      this.project.size.width = width
      this.project.size.height = height
    },
    setRenderScale(scale: number) {
      this.project.export.renderScale = scale
    },
    setOptimizeFor(v: OptimizeFor) {
      this.project.export.optimizeFor = v
    },

    // --- project lifecycle ---
    /** Replace the project from any JSON (older versions are migrated). */
    loadProject(json: unknown) {
      this.project = migrateProject(json)
    },
    serialize(): EmojiProject {
      return JSON.parse(JSON.stringify(this.project))
    },
    reset() {
      this.project = createDefaultProject()
    },
  },
})
