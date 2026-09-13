import type { Spot, Vibe, LatLng } from '../types'
import type { Period } from './time'
import { distanceKm, formatDistance } from './geo'

export type ReasonCode = 'golden' | 'afterglow' | 'night' | 'stargaze' | 'dawn' | 'morning' | 'afternoon' | 'midday' | 'rain' | 'snow' | 'cold' | 'near' | 'vibes' | 'open'

export interface HoursLike { status: 'open' | 'closed' | 'unknown'; confidence: 'high' | 'low' }

export interface Context {
  period: Period
  raining: boolean
  snowing?: boolean
  cold?: boolean
  vibes: Vibe[]
  origin: LatLng | null
  hours?: (spot: Spot) => HoursLike
}

export interface Ranked { spot: Spot; score: number; km: number | null; reasons: ReasonCode[]; hours: HoursLike | null }

/**
 * Scores a spot for "right now" following the period table in docs/DESIGN.md §7.2:
 * time of day x weather x chosen vibes x distance x hours confidence.
 */
export function rankSpot(spot: Spot, ctx: Context): Ranked {
  let score = spot.lowkeyScore * 0.6
  const reasons: [ReasonCode, number][] = []
  const has = (v: Vibe) => spot.vibes.includes(v)
  const bt = spot.bestTimes
  const add = (code: ReasonCode, pts: number) => { score += pts; reasons.push([code, pts]) }

  switch (ctx.period) {
    case 'night':
      if (bt.includes('night') || has('night') || has('skyline')) add('night', 3)
      else if (has('stargaze')) add('stargaze', 3)
      if (spot.safety.level === 'caution') score -= 2.5
      if (!bt.includes('night') && !has('night') && !spot.indoor) score -= 2
      if (spot.indoor) score += 1
      break
    case 'dawn':
      if (has('sunrise') || bt.includes('morning')) add('dawn', 3)
      if (has('quiet')) score += 1
      break
    case 'morning':
      if (bt.includes('morning')) add('morning', 2.5)
      if (has('quiet')) score += 1
      if (has('study') || spot.category === 'library') score += 1
      break
    case 'midday':
      if (has('green') || spot.indoor) add('midday', 1)
      if (bt.includes('afternoon')) score += 1
      if (has('cozy') || has('study')) score += 1
      break
    case 'afternoon':
      if (bt.includes('afternoon')) add('afternoon', 2)
      if (has('people-watch')) score += 1
      break
    case 'golden':
      if (bt.includes('golden-hour') || has('sunset')) add('golden', 3)
      if (has('view') || has('skyline')) score += 1
      break
    case 'dusk':
      if (has('sunset')) add('afterglow', 1.5)
      if (bt.includes('night') || has('night')) add('night', 1.5)
      if (spot.safety.level === 'caution') score -= 1
      break
  }
  if (ctx.raining || ctx.snowing) {
    if (spot.indoor || has('rain-ok')) add(ctx.snowing ? 'snow' : 'rain', 3.5)
    else score -= 3
  }
  if (ctx.cold && has('cozy')) add('cold', 1)
  const matched = ctx.vibes.filter((v) => has(v))
  if (matched.length) add('vibes', 2.2 * matched.length)
  score -= 1.2 * (ctx.vibes.length - matched.length)

  let km: number | null = null
  if (ctx.origin) {
    km = distanceKm(ctx.origin, spot)
    if (km < 1) add('near', 3)
    else if (km < 3) add('near', 2)
    else if (km < 8) score += 1
    else if (km > 40) score -= 2
  }
  const hours = ctx.hours ? ctx.hours(spot) : null
  if (hours?.confidence === 'high') {
    if (hours.status === 'open') add('open', 1.5)
    else if (hours.status === 'closed') score -= 4
  }
  reasons.sort((a, b) => b[1] - a[1])
  return { spot, score, km, reasons: reasons.slice(0, 3).map((r) => r[0]), hours }
}

export function rankSpots(list: Spot[], ctx: Context): Ranked[] {
  return list.map((s) => rankSpot(s, ctx)).sort((a, b) => b.score - a.score || (a.km ?? 0) - (b.km ?? 0))
}

/**
 * The half of the reason line that belongs to the place rather than to the hour.
 *
 * Every row in a list shares a clock, so a line built only out of the period prints the same sentence
 * all the way down. Swept across all 44 cities at five times of day: 1148 of 3021 rows repeated the row
 * directly above them word for word, and 21 of the 220 lists printed twelve to fourteen identical
 * lines. The tail is taken from the spot's own vibes instead, and the orders below lead with whatever
 * tells two places apart rather than with whatever the hour makes relevant — at night nearly every spot
 * in the list is already a night spot, so "holds up after dark" separates nothing and goes last.
 */
const TAIL: Partial<Record<Vibe, string>> = {
  water: 'this is on the water',
  stargaze: 'the sky is dark here',
  skyline: 'this looks out over the city',
  view: 'this has the view',
  sunset: 'this faces the sunset',
  sunrise: 'this faces the sunrise',
  green: 'this is under trees',
  hidden: 'few people find it',
  cozy: 'this is somewhere to settle into',
  study: 'this is somewhere to work',
  picnic: 'there is room to spread out',
  'people-watch': 'there is something to watch',
  quiet: 'this stays quiet',
  walk: 'this is worth the walk',
  night: 'this one holds up after dark',
}

const ORDER: Record<string, Vibe[]> = {
  golden: ['sunset', 'water', 'skyline', 'view', 'hidden', 'green', 'picnic', 'people-watch', 'quiet', 'walk'],
  afterglow: ['sunset', 'water', 'skyline', 'view', 'hidden', 'green', 'quiet', 'walk'],
  night: ['water', 'stargaze', 'skyline', 'view', 'cozy', 'people-watch', 'hidden', 'green', 'study', 'quiet', 'walk', 'night'],
  dawn: ['sunrise', 'water', 'green', 'hidden', 'view', 'picnic', 'quiet', 'walk'],
  morning: ['water', 'green', 'study', 'cozy', 'hidden', 'view', 'picnic', 'people-watch', 'quiet', 'walk'],
  midday: ['water', 'green', 'study', 'cozy', 'hidden', 'picnic', 'view', 'people-watch', 'quiet', 'walk'],
  afternoon: ['water', 'green', 'study', 'picnic', 'cozy', 'hidden', 'people-watch', 'view', 'skyline', 'quiet', 'walk'],
  /* Indoors the outdoor traits are either absent or beside the point. */
  indoors: ['study', 'cozy', 'people-watch', 'hidden', 'quiet'],
}

/**
 * How many of the rows on screen carry each vibe. Order alone cannot separate a list where everything
 * shares its leading trait — all thirteen places in Dubai are on the water — so the tail prefers the
 * rarest of the spot's own candidates here, and falls back to the priority order on a tie.
 */
export function vibeCounts(list: Ranked[]): Map<Vibe, number> {
  const m = new Map<Vibe, number>()
  for (const r of list) for (const v of r.spot.vibes) m.set(v, (m.get(v) ?? 0) + 1)
  return m
}

const tailFor = (s: Spot, order: string, common?: ReadonlyMap<Vibe, number>): string | null => {
  const cands = ORDER[order].filter((v) => s.vibes.includes(v) && TAIL[v])
  if (!cands.length) return null
  if (!common) return TAIL[cands[0]] as string
  let best = cands[0], fewest = common.get(cands[0]) ?? 0
  for (const v of cands) { const n = common.get(v) ?? 0; if (n < fewest) { best = v; fewest = n } }
  return TAIL[best] as string
}

/** Spec §10: every reason line starts with "because". */
export function becauseLine(r: Ranked, ctx: Context, units: 'metric' | 'imperial' = 'metric', common?: ReadonlyMap<Vibe, number>): string | null {
  const code = r.reasons[0]
  if (!code) return null
  const s = r.spot
  const tail = (order: string, fallback: string) => tailFor(s, order, common) ?? fallback
  const inside = (fallback: string) => tailFor(s, 'indoors', common) ?? fallback
  switch (code) {
    case 'golden': return `because it is golden hour and ${tail('golden', 'this is where it lands')}`
    case 'afterglow': return `because the light is still going and ${tail('afterglow', 'this faces it')}`
    // "and open" only when the hours actually said so, and it outranks anything the vibes could say:
    // it is the one thing on the row that was checked. It used to be unconditional for any indoor spot —
    // swept across all 44 cities every two hours, 226 of the 246 rows that printed it were not verified
    // open, most of them sitting directly above their own "see hours" or "closed now".
    case 'night':
      if (s.indoor) {
        return r.hours?.confidence === 'high' && r.hours.status === 'open'
          ? 'because it is late and this is indoors and open'
          : `because it is late and ${inside('this is indoors')}`
      }
      return `because it is late and ${tail('night', 'this stays lit and peopled')}`
    case 'stargaze': return 'because it is dark enough here to see stars'
    case 'dawn': return `because the day is starting and ${tail('dawn', 'this catches first light')}`
    case 'morning': return `because it is early and ${tail('morning', 'this is at its quietest')}`
    case 'afternoon': return `because it is the afternoon and ${tail('afternoon', 'this is easy at this hour')}`
    case 'midday': return s.indoor
      ? `because it is midday and ${inside('this is cool inside')}`
      : `because it is midday and ${tail('midday', 'this has shade')}`
    case 'rain': return `because it is raining and ${inside('this is indoors')}`
    case 'snow': return `because it is snowing and ${inside('this is indoors')}`
    case 'cold': return `because it is cold and ${inside('this is somewhere warm')}`
    case 'near': return r.km !== null ? `because it is ${formatDistance(r.km, units)} away` : null
    case 'vibes': {
      const m = ctx.vibes.filter((v) => s.vibes.includes(v))
      return m.length ? `because you asked for ${m.join(' and ')}` : null
    }
    case 'open': return 'because it is open right now'
  }
}
