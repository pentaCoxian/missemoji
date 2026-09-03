import { useProjectStore } from '~/stores/project'
import { downloadBlob } from '~/utils/download'
import { sanitizeName } from '#core/export/filename'
import { encodeShare } from '#core/project/share'

/** Share links longer than this may be truncated by some chat apps. */
const LONG_LINK_CHARS = 8000

/** Save / load the project as JSON and copy a share link. */
export function useProjectFile() {
  const projectStore = useProjectStore()

  function saveJson() {
    const p = projectStore.serialize()
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `missemoji_${sanitizeName(p.text) || 'project'}.json`)
  }

  /** Resolves with an error message, or null on success (older files are migrated). */
  async function loadJson(file: File): Promise<string | null> {
    try {
      projectStore.loadProject(JSON.parse(await file.text()))
      return null
    } catch (e) {
      return (e as Error).message || 'Could not read that file'
    }
  }

  async function copyShareLink(): Promise<{ ok: boolean; message: string }> {
    try {
      const hash = await encodeShare(projectStore.serialize())
      const link = `${location.origin}${location.pathname}#${hash}`
      await navigator.clipboard.writeText(link)
      return {
        ok: true,
        message:
          link.length > LONG_LINK_CHARS
            ? `Copied (long link: ${Math.round(link.length / 1024)}KB — some apps truncate it)`
            : 'Link copied',
      }
    } catch (e) {
      return { ok: false, message: (e as Error).message || 'Could not copy' }
    }
  }

  return { saveJson, loadJson, copyShareLink }
}
