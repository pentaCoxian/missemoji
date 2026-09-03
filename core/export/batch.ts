/** Upper bound on emojis produced by one batch export (memory + time). */
export const BATCH_MAX = 50

/** One emoji per non-empty line, trimmed, capped at BATCH_MAX. */
export function parseBatchLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, BATCH_MAX)
}
