import { cities, spots } from '../data'
import type { City, Spot } from '../types'

/** Which field produced the winning score, so the row can say why it matched. */
export type Via = 'name' | 'area' | 'city' | 'country' | 'kind' | 'vibe'

export type Hit =
  | { kind: 'city'; city: City; score: number; via: Via }
  | { kind: 'spot'; spot: Spot; city: City; score: number; via: Via }

/** Lowercase and strip accents, so "cafe" finds Café and "montreal" finds Montréal. */
export function fold(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
}

/**
 * How well one field answers the query. Higher is better, 0 is no match. The tiers matter more than
 * the numbers: a word-start beats a mid-word substring, so typing "park" puts Park Güell above
 * Sarphatipark without any hand-tuned per-record weights.
 */
function fieldScore(field: string, q: string): number {
  const f = fold(field)
  if (f === q) return 100
  if (f.startsWith(q)) return 70
  let i = 0
  while ((i = f.indexOf(q, i)) !== -1) {
    if (i > 0 && /[\s\-/'’(]/.test(f[i - 1])) return 45
    i += 1
  }
  return f.includes(q) ? 20 : 0
}

/** The best-scoring field for one word, and which one it was. */
function pick(q: string, fields: [Via, string | null | undefined][]): { score: number; via: Via } {
  let score = 0, via: Via = 'name'
  for (const [v, f] of fields) {
    if (!f) continue
    const s = fieldScore(f, q)
    if (s > score) { score = s; via = v }
  }
  return { score, via }
}

/**
 * Every word has to find a home somewhere, and the scores add up.
 *
 * The query used to be folded into a single needle and matched as one substring against one field at a
 * time, so the most ordinary shape of query was a dead end: "lisbon park", "tokyo garden", "quiet cafe"
 * and "library tokyo" all returned nothing, while "central park" survived only by happening to be
 * contiguous inside three names. Requiring every word and summing the best each one finds means a record
 * has to answer the whole query, and "lisbon park" starts meaning Lisbon's parks. A one-word query sums a
 * single term, so the tiers behave exactly as they did — "park" still puts Park Güell above Sarphatipark.
 */
function scoreTokens(tokens: string[], per: (t: string) => { score: number; via: Via }): { score: number; via: Via } | null {
  let total = 0, best = 0, via: Via = 'name'
  for (const t of tokens) {
    const r = per(t)
    if (!r.score) return null
    total += r.score
    if (r.score > best) { best = r.score; via = r.via }
  }
  return { score: total, via }
}

const citySlugToCity = new Map(cities.map((c) => [c.slug, c]))

/**
 * Cities and spots matching `q`, best first. Cities outrank equally-matched spots because a city is
 * a bigger target and carries its spots with it. `nearCity` nudges the city you are already looking
 * at to the top of its tier. Ties break on lowkey score then alphabetically, deliberately without
 * consulting the clock: a time-based tiebreak would reshuffle the list under an idle finger.
 */
export function search(q: string, limit = 12, nearCity?: string | null): Hit[] {
  const tokens = fold(q.trim()).split(/\s+/).filter(Boolean)
  if (!tokens.length) return []
  const hits: Hit[] = []
  for (const city of cities) {
    const r = scoreTokens(tokens, (t) => pick(t, [['name', city.name], ['country', city.country]]))
    if (r) hits.push({ kind: 'city', city, score: r.score + 8, via: r.via })
  }
  for (const spot of spots) {
    const city = citySlugToCity.get(spot.city)
    if (!city) continue
    const r = scoreTokens(tokens, (t) => {
      // A spot is reachable through its city name too, but weakly: "tokyo" should list Tokyo first and
      // its parks under it, not bury the city under twenty of its own entries.
      const own = pick(t, [['name', spot.name], ['area', spot.neighborhood]])
      const viaCity = fieldScore(city.name, t) ? 12 : 0
      const viaKind = fieldScore(spot.category, t) ? 15 : 0
      const viaVibe = spot.vibes.some((v) => fold(v) === t) ? 15 : 0
      let score = own.score, via = own.via
      if (viaCity > score) { score = viaCity; via = 'city' }
      if (viaKind > score) { score = viaKind; via = 'kind' }
      if (viaVibe > score) { score = viaVibe; via = 'vibe' }
      return { score, via }
    })
    if (r) hits.push({ kind: 'spot', spot, city, score: r.score + (nearCity && spot.city === nearCity ? 12 : 0), via: r.via })
  }
  const name = (h: Hit) => (h.kind === 'city' ? h.city.name : h.spot.name)
  const lowkey = (h: Hit) => (h.kind === 'spot' ? h.spot.lowkeyScore : 0)
  hits.sort((a, b) =>
    b.score - a.score ||
    (a.kind === b.kind ? 0 : a.kind === 'city' ? -1 : 1) ||
    lowkey(b) - lowkey(a) ||
    name(a).localeCompare(name(b)))
  return hits.slice(0, limit)
}

export const hitId = (h: Hit) => (h.kind === 'city' ? `c:${h.city.slug}` : `s:${h.spot.id}`)
export const hitHash = (h: Hit) => (h.kind === 'city' ? `#/c/${h.city.slug}` : `#/s/${h.spot.id}`)
