/**
 * Yield to the event loop between units of work so a worker (or the main
 * thread) can receive messages — e.g. a cancel — mid-job. Prefers the
 * Prioritized Task Scheduling API, then a MessageChannel ping (not subject to
 * setTimeout's 4 ms clamping), then setTimeout.
 */
export function yieldMacrotask(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  if (scheduler?.yield) return scheduler.yield()
  if (typeof MessageChannel !== 'undefined') {
    return new Promise((resolve) => {
      const ch = new MessageChannel()
      ch.port1.onmessage = () => {
        ch.port1.close()
        resolve()
      }
      ch.port2.postMessage(null)
    })
  }
  return new Promise((resolve) => setTimeout(resolve, 0))
}
