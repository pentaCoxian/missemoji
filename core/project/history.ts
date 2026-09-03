/**
 * Undo / redo over serialized project snapshots. Pure and immutable so the
 * Pinia wrapper stays trivial and the sequencing is unit-testable.
 */
export interface HistoryState {
  past: string[]
  present: string
  future: string[]
}

export const HISTORY_MAX = 100

export function createHistory(present: string): HistoryState {
  return { past: [], present, future: [] }
}

/** Record a new snapshot; null when it equals the present (no-op). */
export function commit(s: HistoryState, json: string): HistoryState | null {
  if (json === s.present) return null
  const past = [...s.past, s.present]
  if (past.length > HISTORY_MAX) past.splice(0, past.length - HISTORY_MAX)
  return { past, present: json, future: [] }
}

export function undo(s: HistoryState): HistoryState | null {
  if (s.past.length === 0) return null
  const past = s.past.slice(0, -1)
  const present = s.past[s.past.length - 1]!
  return { past, present, future: [s.present, ...s.future] }
}

export function redo(s: HistoryState): HistoryState | null {
  if (s.future.length === 0) return null
  const [present, ...future] = s.future
  return { past: [...s.past, s.present], present: present!, future }
}
