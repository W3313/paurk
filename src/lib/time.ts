import * as SunCalc from 'suncalc'
import type { LatLng } from '../types'

export type Period = 'night' | 'dawn' | 'morning' | 'midday' | 'afternoon' | 'golden' | 'dusk'

export interface SunInfo {
  period: Period
  sunrise: Date | null
  sunset: Date | null
  goldenStart: Date | null
  /** Minutes until the next golden hour starts (or 0 if in it), null if unknown. */
  minutesToGolden: number | null
  minutesToSunset: number | null
  minutesToSunrise: number | null
  /** 0 at solar midnight .. 1 at solar noon, smooth. Drives the theme. */
  daylight: number
  polar: boolean
}

const valid = (d: Date | null | undefined) => (d && !Number.isNaN(d.getTime()) ? d : null)
const minutesBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60000)

export function sunInfo(now: Date, pos: LatLng): SunInfo {
  const t = SunCalc.getTimes(now, pos.lat, pos.lng)
  const sunrise = valid(t.sunrise), sunset = valid(t.sunset), goldenStart = valid(t.goldenHour)
  const dawn = valid(t.dawn), dusk = valid(t.dusk), goldenEnd = valid(t.goldenHourEnd), noon = valid(t.solarNoon)
  const polar = !sunrise || !sunset

  let period: Period
  if (polar) {
    const h = now.getHours()
    period = h < 5 ? 'night' : h < 7 ? 'dawn' : h < 11 ? 'morning' : h < 14 ? 'midday' : h < 17 ? 'afternoon' : h < 19 ? 'golden' : h < 21 ? 'dusk' : 'night'
  } else {
    const sr = sunrise as Date, ss = sunset as Date
    if (dawn && now < dawn) period = 'night'
    else if (now < sr) period = 'dawn'
    else if (goldenEnd && now < goldenEnd) period = 'morning'
    else if (noon && now < new Date(noon.getTime() + 90 * 60000)) period = 'midday'
    else if (goldenStart && now < goldenStart) period = 'afternoon'
    else if (now < ss) period = 'golden'
    else if (dusk && now < dusk) period = 'dusk'
    else period = 'night'
  }

  // Next-day lookups for countdowns after sunset.
  const tomorrow = SunCalc.getTimes(new Date(now.getTime() + 86400000), pos.lat, pos.lng)
  const nextSunrise = sunrise && now < sunrise ? sunrise : valid(tomorrow.sunrise)
  const nextGolden = goldenStart && now < goldenStart ? goldenStart : valid(tomorrow.goldenHour)
  const nextSunset = sunset && now < sunset ? sunset : valid(tomorrow.sunset)

  const alt = SunCalc.getPosition(now, pos.lat, pos.lng).altitude // radians, -π/2..π/2
  const daylight = Math.min(1, Math.max(0, (alt + 0.2) / 0.9))

  return {
    period,
    sunrise, sunset, goldenStart,
    minutesToGolden: period === 'golden' ? 0 : nextGolden ? minutesBetween(now, nextGolden) : null,
    minutesToSunset: nextSunset ? minutesBetween(now, nextSunset) : null,
    minutesToSunrise: nextSunrise ? minutesBetween(now, nextSunrise) : null,
    daylight,
    polar,
  }
}

export function formatClock(date: Date, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone }).format(date)
  } catch {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
  }
}

export function formatCountdown(minutes: number): string {
  if (minutes <= 0) return 'now'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60), m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

/** Local hour (0-23, fractional) in a given IANA zone. */
export function localHour(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: false, timeZone }).formatToParts(date)
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
    return h + m / 60
  } catch {
    return date.getHours() + date.getMinutes() / 60
  }
}

export const PERIOD_LABEL: Record<Period, string> = {
  night: 'night',
  dawn: 'first light',
  morning: 'morning',
  midday: 'midday',
  afternoon: 'afternoon',
  golden: 'golden hour',
  dusk: 'blue hour',
}
