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
  /** Minutes until the end of dusk ("dark"), null if unknown or already dark. */
  minutesToDark: number | null
  /** 0 at solar midnight .. 1 at solar noon, smooth. Drives the theme. */
  daylight: number
  polar: boolean
}

const valid = (d: Date | null | undefined) => (d && !Number.isNaN(d.getTime()) ? d : null)
const minutesBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60000)

export function sunInfo(now: Date, pos: LatLng): SunInfo {
  const t = SunCalc.getTimes(now, pos.lat, pos.lng)
  const sunrise = valid(t.sunrise), sunset = valid(t.sunset)
  // Spec §7.2: golden hour is the last 90 minutes before sunset.
  const goldenStart = sunset ? new Date(sunset.getTime() - 90 * 60000) : null
  const dawn = valid(t.dawn), dusk = valid(t.dusk), noon = valid(t.solarNoon)
  const polar = !sunrise || !sunset

  let period: Period
  if (polar) {
    const h = now.getHours()
    period = h < 5 ? 'night' : h < 7 ? 'dawn' : h < 11 ? 'morning' : h < 14 ? 'midday' : h < 17 ? 'afternoon' : h < 19 ? 'golden' : h < 21 ? 'dusk' : 'night'
  } else {
    // Bands are anchored to solar noon and sunset, not to SunCalc's golden-hour angles, so that
    // "morning" covers the actual morning: sunrise .. noon-90, midday .. noon+90, then afternoon.
    const sr = sunrise as Date, ss = sunset as Date
    const middayStart = noon ? new Date(noon.getTime() - 90 * 60000) : null
    const middayEnd = noon ? new Date(noon.getTime() + 90 * 60000) : null
    if (dawn && now < dawn) period = 'night'
    else if (now < sr) period = 'dawn'
    else if (now >= ss) period = dusk && now < dusk ? 'dusk' : 'night'
    else if (goldenStart && now >= goldenStart) period = 'golden'
    else if (middayStart && now < middayStart) period = 'morning'
    else if (middayEnd && now < middayEnd) period = 'midday'
    else period = 'afternoon'
  }

  // Next-day lookups for countdowns after sunset.
  const tomorrow = SunCalc.getTimes(new Date(now.getTime() + 86400000), pos.lat, pos.lng)
  const nextSunrise = sunrise && now < sunrise ? sunrise : valid(tomorrow.sunrise)
  const tomorrowSunset = valid(tomorrow.sunset)
  const nextGolden = goldenStart && now < goldenStart ? goldenStart : tomorrowSunset ? new Date(tomorrowSunset.getTime() - 90 * 60000) : null
  const nextSunset = sunset && now < sunset ? sunset : valid(tomorrow.sunset)

  const alt = SunCalc.getPosition(now, pos.lat, pos.lng).altitude // radians, -π/2..π/2
  const daylight = Math.min(1, Math.max(0, (alt + 0.2) / 0.9))

  return {
    period,
    sunrise, sunset, goldenStart,
    minutesToDark: dusk && now < dusk ? minutesBetween(now, dusk) : null,
    minutesToGolden: period === 'golden' ? 0 : nextGolden ? minutesBetween(now, nextGolden) : null,
    minutesToSunset: nextSunset ? minutesBetween(now, nextSunset) : null,
    minutesToSunrise: nextSunrise ? minutesBetween(now, nextSunrise) : null,
    daylight,
    polar,
  }
}

export function formatClock(date: Date, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
  }
}

export function formatCountdown(minutes: number): string {
  // Every caller says "<something> in ${this}", so 'now' read as "sunset in now".
  if (minutes <= 0) return '0m'
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

/** Minutes since local midnight in a zone. */
export function localMinutes(date: Date, timeZone: string): number {
  return Math.round(localHour(date, timeZone) * 60)
}

/** The instant that is `minutes` past local midnight on `base`'s local date in `timeZone`. */
export function instantAtLocalMinutes(base: Date, timeZone: string, minutes: number): Date {
  const cur = localMinutes(base, timeZone)
  let t = new Date(base.getTime() + (minutes - cur) * 60000)
  // A DST change between base and t shifts the wall clock; correct once by the shortest way round.
  const got = localMinutes(t, timeZone)
  const diff = ((minutes - got + 720 + 1440) % 1440) - 720
  if (diff !== 0) t = new Date(t.getTime() + diff * 60000)
  return t
}

/** Local weekday index (0 = Sunday) in a zone. */
export function localWeekday(date: Date, timeZone: string): number {
  try {
    const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(date)
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd)
  } catch {
    return date.getDay()
  }
}

/** UTC offset in minutes for a zone at an instant. */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date)
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
    const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
    return Math.round((asUTC - date.getTime()) / 60000)
  } catch {
    return -date.getTimezoneOffset()
  }
}
