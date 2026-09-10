import type { Spot, Vibe, LatLng } from '../types'
import type { Period } from './time'
import { distanceKm } from './geo'

export interface Context {
  period: Period
  raining: boolean
  vibes: Vibe[]
  origin: LatLng | null
}

export interface Ranked { spot: Spot; score: number; km: number | null; reasons: string[] }

/**
 * Scores a spot for "right now". Time of day, weather, the user's chosen vibes
 * and distance all contribute; the reasons explain the top signals in plain words.
 */
export function rankSpot(spot: Spot, ctx: Context): Ranked {
  let score = spot.lowkeyScore * 0.6
  const reasons: string[] = []
  const has = (v: Vibe) => spot.vibes.includes(v)
  const bt = spot.bestTimes

  switch (ctx.period) {
    case 'golden':
      if (bt.includes('golden-hour') || has('sunset')) { score += 3; reasons.push('golden hour spot') }
      if (has('view') || has('skyline')) score += 1
      break
    case 'dusk':
      if (has('sunset')) { score += 1.5; reasons.push('afterglow') }
      if (bt.includes('night') || has('night')) { score += 1.5 }
      break
    case 'night':
      if (bt.includes('night') || has('night')) { score += 3; reasons.push('good after dark') }
      if (has('stargaze')) { score += 1.5; reasons.push('stargazing') }
      if (spot.safety.level === 'caution') score -= 2.5
      if (!bt.includes('night') && !has('night') && !spot.indoor) score -= 2
      break
    case 'dawn':
      if (has('sunrise') || bt.includes('morning')) { score += 3; reasons.push('first light') }
      break
    case 'morning':
      if (bt.includes('morning')) { score += 2.5; reasons.push('best in the morning') }
      if (has('quiet')) score += 1
      break
    case 'midday':
      if (has('green') || spot.indoor) score += 1
      if (bt.includes('afternoon')) score += 1
      break
    case 'afternoon':
      if (bt.includes('afternoon')) { score += 2; reasons.push('afternoon-friendly') }
      break
  }
  if (ctx.raining) {
    if (spot.indoor || has('rain-ok')) { score += 3.5; reasons.push('rain-proof') }
    else score -= 3
  }
  for (const v of ctx.vibes) {
    if (has(v)) { score += 2.2; reasons.push(v) }
    else score -= 1.2
  }
  let km: number | null = null
  if (ctx.origin) {
    km = distanceKm(ctx.origin, spot)
    if (km < 1) { score += 3; reasons.push('walkable') }
    else if (km < 3) { score += 2; reasons.push('close by') }
    else if (km < 8) score += 1
    else if (km > 40) score -= 2
  }
  return { spot, score, km, reasons: reasons.slice(0, 3) }
}

export function rankSpots(list: Spot[], ctx: Context): Ranked[] {
  return list.map((s) => rankSpot(s, ctx)).sort((a, b) => b.score - a.score || (a.km ?? 0) - (b.km ?? 0))
}

/** Deterministic daily pick: same spot for everyone in a city for a given day. */
export function dailyPick(list: Spot[], date: Date): Spot | null {
  if (!list.length) return null
  const day = Math.floor((date.getTime() + date.getTimezoneOffset() * -60000) / 86400000)
  return list[Math.abs(day * 2654435761) % list.length]
}
