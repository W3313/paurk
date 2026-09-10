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

const CACHE_KEY = 'tc.photos.v1'
const TTL = 7 * 86400000
type CacheEntry = { t: number; p: Photo | null }
let mem: Record<string, CacheEntry> | null = null

function readCache(): Record<string, CacheEntry> {
  if (mem) return mem
  try {
    mem = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, CacheEntry>
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
  const cache = readCache()
  const hit = cache[title]
  if (hit && Date.now() - hit.t < TTL) return Promise.resolve(hit.p)
  const existing = inflight.get(title)
  if (existing) return existing

  const p = (async () => {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(String(res.status))
      const j = (await res.json()) as {
        thumbnail?: { source: string; width: number; height: number }
        originalimage?: { source: string; width: number; height: number }
        content_urls?: { desktop?: { page?: string } }
        title?: string
      }
      if (!j.thumbnail) return null
      const w = Math.min(targetWidth, j.originalimage?.width ?? targetWidth)
      const scale = w / j.thumbnail.width
      const photo: Photo = {
        src: widen(j.thumbnail.source, w),
        width: w,
        height: Math.round(j.thumbnail.height * scale),
        pageUrl: j.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
        fileUrl: commonsFilePage(j.originalimage?.source ?? j.thumbnail.source),
        credit: 'Wikimedia Commons',
      }
      return photo
    } catch {
      return null
    }
  })()
  inflight.set(title, p)
  p.then((photo) => {
    cache[title] = { t: Date.now(), p: photo }
    writeCache()
    inflight.delete(title)
  })
  return p
}
