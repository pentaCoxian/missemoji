import type { EmojiProject } from './schema'
import { migrateProject } from './migrate'

/**
 * Share-link codec: the project JSON in the URL hash as `#p=<codec>.<base64url>`.
 * Codec `d` = deflate-raw via CompressionStream (typical projects ≈ 500 chars),
 * `j` = plain UTF-8 JSON when compression is unavailable. Decoding always runs
 * the result through migrateProject so an old or hand-edited link still loads.
 */
const KEY = 'p'

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function pipe(bytes: Uint8Array, stream: GenericTransformStream) {
  const src = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(src).arrayBuffer())
}

export async function encodeShare(
  project: EmojiProject,
  opts: { compress?: boolean } = {},
): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(project))
  if (opts.compress !== false && typeof CompressionStream !== 'undefined') {
    const deflated = await pipe(bytes, new CompressionStream('deflate-raw'))
    return `${KEY}=d.${toBase64Url(deflated)}`
  }
  return `${KEY}=j.${toBase64Url(bytes)}`
}

/** Parse a location.hash (with or without `#`); null when absent or invalid. */
export async function decodeShare(hash: string): Promise<EmojiProject | null> {
  try {
    const h = hash.startsWith('#') ? hash.slice(1) : hash
    const value = new URLSearchParams(h).get(KEY)
    if (!value) return null
    const dot = value.indexOf('.')
    if (dot < 0) return null
    const codec = value.slice(0, dot)
    let bytes = fromBase64Url(value.slice(dot + 1))
    if (codec === 'd') {
      if (typeof DecompressionStream === 'undefined') return null
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'))
    } else if (codec !== 'j') {
      return null
    }
    return migrateProject(JSON.parse(new TextDecoder().decode(bytes)))
  } catch {
    return null
  }
}
