/**
 * Typed worker message protocol (spec §18). Render and encode run in workers;
 * the main thread keeps the live preview. RGBA buffers are always passed in the
 * `transfer` list (zero-copy). Every message carries a `jobId` for correlation
 * and cancellation.
 *
 * This file imports ONLY types — no Vue/Pinia — so worker bundles stay lean.
 */
import type { EmojiProject, ExportFormat, OptimizeFor } from '#core/project/schema'
import type { LayoutResult } from '#core/layout/types'
import type { Bounds } from '#core/types'

export interface TransferableFrame {
  index: number
  rgba: ArrayBuffer
  width: number
  height: number
  delayMs: number
}

// ---- Render worker ----

export type RenderRequest =
  | {
      type: 'render-frames'
      jobId: string
      project: EmojiProject
      layout: LayoutResult
    }
  | {
      type: 'analyze-bounds'
      jobId: string
      project: EmojiProject
      layout: LayoutResult
      threshold: number
    }
  | { type: 'cancel'; jobId: string }

export type RenderResponse =
  | { type: 'frame'; jobId: string; frame: TransferableFrame }
  | { type: 'frames-done'; jobId: string; count: number }
  | { type: 'bounds'; jobId: string; bounds: Bounds }
  | { type: 'progress'; jobId: string; stage: 'render'; done: number; total: number }
  | { type: 'error'; jobId: string; message: string }
  | { type: 'cancelled'; jobId: string }

// ---- Encode worker ----

export interface EncodeRequestOpts {
  format: ExportFormat
  width: number
  height: number
  loop: boolean
  optimizeFor: OptimizeFor
  /** preferred APNG backend id (e.g. 'upng-js' | 'wasm'); optional */
  apngBackend?: string
}

export type EncodeRequest =
  | {
      type: 'encode'
      jobId: string
      frames: TransferableFrame[]
      opts: EncodeRequestOpts
    }
  | { type: 'cancel'; jobId: string }

export type EncodeResponse =
  | {
      type: 'progress'
      jobId: string
      stage: 'optimize' | 'encode'
      done: number
      total: number
    }
  | {
      type: 'result'
      jobId: string
      format: ExportFormat
      bytes: number
      mime: string
      data: ArrayBuffer
    }
  | { type: 'error'; jobId: string; message: string }
  | { type: 'cancelled'; jobId: string }
