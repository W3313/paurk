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

/** Spec §10: every reason line starts with "because". */
export function becauseLine(r: Ranked, ctx: Context, units: 'metric' | 'imperial' = 'metric'): string | null {
  const code = r.reasons[0]
  if (!code) return null
  const s = r.spot
  switch (code) {
    case 'golden': return s.vibes.includes('view') || s.vibes.includes('skyline') ? 'because it is golden hour and this has the view' : 'because it is golden hour and this is where it lands'
    case 'afterglow': return 'because the light is still going and this faces it'
    case 'night': return s.indoor ? 'because it is late and this is indoors and open' : 'because it is late and this stays lit and peopled'
    case 'stargaze': return 'because it is dark enough here to see stars'
    case 'dawn': return 'because the day is starting and this catches first light'
    case 'morning': return 'because mornings are when this is quietest'
    case 'afternoon': return 'because this is easy in the afternoon'
    case 'midday': return s.indoor ? 'because it is midday and this is cool inside' : 'because it is midday and this has shade'
    case 'rain': return 'because it is raining and this is indoors'
    case 'snow': return 'because it is snowing and this is indoors'
    case 'cold': return 'because it is cold and this is cosy'
    case 'near': return r.km !== null ? `because it is ${formatDistance(r.km, units)} away` : null
    case 'vibes': {
      const m = ctx.vibes.filter((v) => s.vibes.includes(v))
      return m.length ? `because you asked for ${m.join(' and ')}` : null
    }
    case 'open': return 'because it is open right now'
  }
}

/** Deterministic daily pick: the same spot for everyone in a city on a given day; `offset` = "another". */
export function dailyPick(list: Spot[], date: Date, offset = 0): Spot | null {
  if (!list.length) return null
  const day = Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000)
  return list[(Math.abs(day * 2654435761) + offset) % list.length]
}
