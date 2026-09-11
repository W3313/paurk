import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()
beforeEach(() => {
  vi.resetModules()
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  })
})
afterEach(() => { vi.unstubAllGlobals() })

const summary = {
  thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Elevated_Acre.jpg/320px-Elevated_Acre.jpg', width: 320, height: 213 },
  originalimage: { source: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Elevated_Acre.jpg', width: 4000, height: 2667 },
  content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Elevated_Acre' } },
}

describe('fetchWikiPhoto', () => {
  it('upscales the thumbnail, links the Commons file page and caches the result', async () => {
    const fetchMock = vi.fn(async (_url: string) => ({ ok: true, json: async () => summary }))
    vi.stubGlobal('fetch', fetchMock)
    const { fetchWikiPhoto } = await import('../lib/photos')
    const p = await fetchWikiPhoto('Elevated Acre', 900)
    expect(p?.src).toContain('/900px-Elevated_Acre.jpg')
    expect(p?.height).toBe(Math.round(213 * (900 / 320)))
    expect(p?.fileUrl).toBe('https://commons.wikimedia.org/wiki/File:Elevated_Acre.jpg')
    expect(p?.pageUrl).toBe('https://en.wikipedia.org/wiki/Elevated_Acre')
    expect(fetchMock.mock.calls[0][0]).toContain('/page/summary/Elevated_Acre')
    const again = await fetchWikiPhoto('Elevated Acre', 900)
    expect(again?.src).toBe(p?.src)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('returns null (and caches the miss) when the article has no image or the request fails', async () => {
    const fetchMock = vi.fn(async (_url: string) => ({ ok: false, status: 404, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetchMock)
    const { fetchWikiPhoto } = await import('../lib/photos')
    expect(await fetchWikiPhoto('Nope')).toBeNull()
    expect(await fetchWikiPhoto('Nope')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('fetchWikiPhoto transient failures', () => {
  it('does not cache a network error or 5xx, but does cache a 404', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async (_url: string) => { calls++; if (calls === 1) throw new TypeError('offline'); if (calls === 2) return { ok: false, status: 503, json: async () => ({}) }; return { ok: false, status: 404, json: async () => ({}) } }))
    const { fetchWikiPhoto } = await import('../lib/photos')
    expect(await fetchWikiPhoto('Flaky')).toBeNull()
    expect(await fetchWikiPhoto('Flaky')).toBeNull()
    expect(await fetchWikiPhoto('Flaky')).toBeNull()
    expect(await fetchWikiPhoto('Flaky')).toBeNull() // cached 404
    expect(calls).toBe(3)
  })
})
