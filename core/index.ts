/**
 * Public surface of the framework-agnostic core library.
 * The app and workers import from `#core` (this barrel) for cross-cutting
 * types, or from subpaths like `#core/layout/solve` for tree-shaking.
 */
export * from './types'
export * from './project/schema'
export { createDefaultProject } from './project/defaults'
export { classifyChange, type RecomputeFlags } from './project/dirty'
export { computeSafeMargins, type SafeMargins } from './layout/safebox'
export { solveLayout } from './layout/solve'
export type { LayoutResult, LayoutLine } from './layout/types'
export {
  renderProjectFrame,
  computeRenderBounds,
  type RenderOptions,
} from './render/renderProject'
export { createSurface, type RenderSurface } from './render/renderContext'
export { clearMeasureCache } from './layout/measureText'
export type { FrameState } from './animation/model'
export { PRESETS, getPreset, presetOvershoot, type AnimationPreset } from './animation/presets'
export { buildFramePlan } from './animation/frames'
export {
  FONT_CATALOG,
  groupedCatalog,
  getFontDescriptor,
  type FontDescriptor,
  type FontGroup,
} from './fonts/catalog'
export { loadGoogleFont } from './fonts/loadFont'
export { buildCss2Url } from './fonts/googleFontsCss'
export { setCanvasFactory, type CanvasFactory } from './render/renderContext'
export { EXPORT_PRESETS, getExportPreset, type ExportPreset } from './presets/exportPresets'
export { readabilityPenalty } from './presets/readability'
export { buildWarnings, estimateBytes, type Warning } from './export/sizeEstimate'
export { getEncoder } from './export/registry'
export { renderAllFrames } from './render/renderAllFrames'
export { setApngBackend, getApngBackend } from './export/apng/backend'
export type { ApngBackend } from './export/types'
