/**
 * Runtime photo loading. Each spot may name its English Wikipedia article; the
 * page's lead image is fetched from Wikipedia's public REST API in the user's
 * browser (CORS-enabled, no key). Results are cached in localStorage.
 */
export interface Photo {
  src: string
  width: number
  height: number
  pageUrl: string
  fileUrl: string | null
  credit: string
}

const CACHE_KEY = 'paurk.photos.v1'
const TTL = 7 * 86400000
type CacheEntry = { t: number; p: Photo | null }
let mem: Record<string, CacheEntry> | null = null

const WIKI_HOSTS = /^https:\/\/(upload\.wikimedia\.org|commons\.wikimedia\.org|[a-z-]+\.wikipedia\.org)\//
const safeUrl = (u: unknown): u is string => typeof u === 'string' && u.length < 2000 && WIKI_HOSTS.test(u)
function validEntry(e: unknown): e is CacheEntry {
  if (!e || typeof e !== 'object') return false
  const { t, p } = e as { t?: unknown; p?: unknown }
  if (typeof t !== 'number') return false
  if (p === null) return true
  if (!p || typeof p !== 'object') return false
  const ph = p as Partial<Photo>
  return safeUrl(ph.src) && safeUrl(ph.pageUrl) && (ph.fileUrl === null || safeUrl(ph.fileUrl)) && typeof ph.width === 'number' && typeof ph.height === 'number'
}

function readCache(): Record<string, CacheEntry> {
  if (mem) return mem
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
    mem = {}
    if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (validEntry(v)) mem[k] = v
  } catch {
    mem = {}
  }
  return mem
}
function writeCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(mem ?? {}))
  } catch {
    /* storage unavailable: ignore */
  }
}

const inflight = new Map<string, Promise<Photo | null>>()

/** Upscale a Commons thumbnail URL (…/320px-Name.jpg -> …/{w}px-Name.jpg). */
function widen(url: string, w: number): string {
  return url.replace(/\/(\d+)px-/, `/${w}px-`)
}

function commonsFilePage(originalUrl: string | undefined): string | null {
  if (!originalUrl) return null
  const m = originalUrl.match(/\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/)
  return m ? `https://commons.wikimedia.org/wiki/File:${m[1]}` : null
}

export function fetchWikiPhoto(title: string, targetWidth = 900): Promise<Photo | null> {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const cache = readCache()
  const hit = cache[title]
  if (hit && Date.now() - hit.t < TTL) return Promise.resolve(hit.p)
  const existing = inflight.get(title)
  if (existing) return existing

  const p: Promise<Photo | null | undefined> = (async () => {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), 8000)
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ac.signal }).finally(() => clearTimeout(timer))
      if (res.status === 404) return null
      if (!res.ok) throw new Error(String(res.status))
      const j = (await res.json()) as {
        thumbnail?: { source: string; width: number; height: number }
        originalimage?: { source: string; width: number; height: number }
        content_urls?: { desktop?: { page?: string } }
        title?: string
      }
      if (!j.thumbnail || !safeUrl(j.thumbnail.source)) return null
      const w = Math.min(targetWidth, j.originalimage?.width ?? targetWidth)
      const scale = w / j.thumbnail.width
      const page = j.content_urls?.desktop?.page
      const photo: Photo = {
        src: widen(j.thumbnail.source, w),
        width: w,
        height: Math.round(j.thumbnail.height * scale),
        pageUrl: safeUrl(page) ? page : `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
        fileUrl: commonsFilePage(j.originalimage?.source ?? j.thumbnail.source),
        credit: 'Wikimedia Commons',
      }
      if (!validEntry({ t: 0, p: photo })) return null
      return photo
    } catch {
      return undefined // transient: not cached
    }
  })()
  const settled = p.then((photo) => {
    if (photo !== undefined) { cache[title] = { t: Date.now(), p: photo }; writeCache() }
    inflight.delete(title)
    return photo ?? null
  })
  inflight.set(title, settled)
  return settled
}
