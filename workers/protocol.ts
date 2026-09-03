/**
 * Typed worker message protocol (spec §18). One render worker serves BOTH the
 * live preview (frames as transferable ImageBitmaps) and export (frames as
 * transferable RGBA); an encode worker turns RGBA frames into files. Every
 * job message carries a `jobId`; `hello` is sent once, unsolicited, when a
 * worker boots so the client learns its capabilities.
 *
 * This file imports ONLY types — no Vue/Pinia — so worker bundles stay lean.
 */
import type { EmojiProject, ExportFormat, OptimizeFor } from '#core/project/schema'
import type { LayoutResult } from '#core/layout/types'
import type { FrameStats } from '#core/types'
import type { FontFaceSource } from '#core/fonts/fontSource'

export interface TransferableFrame {
  index: number
  rgba: ArrayBuffer
  width: number
  height: number
  delayMs: number
}

// ---- Render worker ----

export interface RenderCaps {
  /** the worker can register FontFace objects (self.fonts) */
  fonts: boolean
  offscreenCanvas: boolean
  canvasFilter: boolean
}

export type RenderOutput = 'bitmap' | 'rgba'

export interface RenderJobRequest {
  project: EmojiProject
  /** solved on the main thread; null lets the worker solve it */
  layout: LayoutResult | null
  /** faces the worker must have loaded before rendering */
  faces: FontFaceSource[]
  output: RenderOutput
}

export type RenderRequest =
  | { type: 'load-fonts'; jobId: string; faces: FontFaceSource[] }
  | ({ type: 'render'; jobId: string } & RenderJobRequest)
  | { type: 'cancel'; jobId: string }

export type RenderStage = 'fonts' | 'layout' | 'render'

export type RenderResponse =
  | { type: 'hello'; caps: RenderCaps }
  | { type: 'fonts-loaded'; jobId: string; loaded: number; failed: number }
  | { type: 'progress'; jobId: string; stage: RenderStage; done: number; total: number }
  | { type: 'frame'; jobId: string; frame: TransferableFrame; stats: FrameStats }
  | {
      type: 'bitmap'
      jobId: string
      index: number
      total: number
      bitmap: ImageBitmap
      delayMs: number
      stats: FrameStats
    }
  | { type: 'done'; jobId: string; count: number; layout: LayoutResult; stats: FrameStats[] }
  | { type: 'error'; jobId: string; message: string }
  | { type: 'cancelled'; jobId: string }

// ---- Encode worker ----

export type ApngEngine = 'upng' | 'wasm'

export interface EncodeRequestOpts {
  format: ExportFormat
  width: number
  height: number
  loop: boolean
  optimizeFor: OptimizeFor
  /** preferred APNG backend; falls back to upng when wasm is unavailable */
  apngBackend?: ApngEngine
}

export type EncodeRequest =
  | { type: 'encode'; jobId: string; frames: TransferableFrame[]; opts: EncodeRequestOpts }
  | { type: 'cancel'; jobId: string }

export type EncodeResponse =
  | { type: 'hello'; caps: { wasmApng: boolean } }
  | { type: 'progress'; jobId: string; stage: 'optimize' | 'encode'; done: number; total: number }
  | {
      type: 'result'
      jobId: string
      format: ExportFormat
      bytes: number
      mime: string
      data: ArrayBuffer
      backendUsed: string
      framesEncoded: number
    }
  | { type: 'error'; jobId: string; message: string }
  | { type: 'cancelled'; jobId: string }
