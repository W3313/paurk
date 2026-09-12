import type { City } from '../types'
import { formatClock, formatCountdown, PERIOD_LABEL, sunInfo, tzOffsetMinutes, type Period, type SunInfo } from './time'
import type { Weather } from '../store'

export const HORIZON_TOKEN: Record<Period, string> = {
  night: 'var(--h-night)', dawn: 'var(--h-dawn)', morning: 'var(--h-morning)', midday: 'var(--h-midday)',
  afternoon: 'var(--h-afternoon)', golden: 'var(--h-golden)', dusk: 'var(--h-dusk)',
}
export function horizonHeight(period: Period, mobile: boolean): string {
  switch (period) {
    case 'night': return mobile ? '55vh' : '60vh'
    case 'dawn': return '45vh'
    case 'morning': return '40vh'
    case 'midday': return '35vh'
    case 'afternoon': return '40vh'
    case 'golden': return '45vh'
    case 'dusk': return '50vh'
  }
}

export interface PhaseOpts { preview?: boolean; offline?: boolean; weather?: Weather | null }

/** The phase line, spec §7.3: `HH:MM · <period word> · <next event>` with modifiers. */
export function phaseLine(now: Date, sun: SunInfo, timeZone: string, opts: PhaseOpts = {}): string {
  const clock = formatClock(now, timeZone)
  const parts: string[] = []
  parts.push(opts.preview ? `if it were ${clock}` : clock)
  const word = PERIOD_LABEL[sun.period]
  const next = nextEvent(sun)
  switch (sun.period) {
    case 'golden':
      parts.push(sun.minutesToGolden === 0 && sun.minutesToSunset !== null ? `golden hour · sunset in ${formatCountdown(sun.minutesToSunset)}` : 'golden hour')
      break
    case 'afternoon':
      parts.push(word, next ?? 'the long part of the day')
      break
    case 'morning':
      parts.push(word, sun.minutesToGolden !== null && sun.minutesToGolden < 240 ? `golden hour in ${formatCountdown(sun.minutesToGolden)}` : 'a good time for the quiet ones')
      break
    case 'midday':
      parts.push(word, 'shade and libraries')
      break
    default:
      parts.push(word)
      if (next) parts.push(next)
  }
  const w = opts.weather
  if (w?.isSnowing) parts.push('snowing, indoor picks first')
  else if (w?.isRaining) parts.push('raining, indoor picks first')
  else if (w && w.tempC < 5) parts.push('cold')
  if (opts.offline) parts.push('offline')
  return parts.join(' · ')
}

/** Minutes until whatever `nextEvent` names there, so lists can be ordered by what happens soonest. */
export function nextEventMinutes(sun: SunInfo): number | null {
  switch (sun.period) {
    case 'night': case 'dawn': return sun.minutesToSunrise
    case 'dusk': return sun.minutesToDark
    case 'golden': return sun.minutesToSunset
    default: return sun.minutesToGolden
  }
}

const NEXT_LABEL: Record<Period, string> = {
  night: 'sunrise', dawn: 'sunrise', dusk: 'dark', golden: 'sunset',
  morning: 'golden hour', midday: 'golden hour', afternoon: 'golden hour',
}

export function nextEvent(sun: SunInfo): string | null {
  const minutes = nextEventMinutes(sun)
  return minutes === null ? null : `${NEXT_LABEL[sun.period]} in ${formatCountdown(minutes)}`
}

/** Suggested vibes per period (accent dot in the vibe row). */
export const SUGGESTED: Record<Period, string[]> = {
  night: ['night', 'stargaze', 'cozy'], dawn: ['sunrise', 'quiet', 'water'], morning: ['quiet', 'green', 'study'],
  midday: ['green', 'study', 'rain-ok'], afternoon: ['people-watch', 'walk', 'picnic'], golden: ['sunset', 'view', 'water'], dusk: ['night', 'skyline', 'cozy'],
}

/** The city whose zone matches the browser's, else the same offset nearest by longitude, else null. */
export function guessCity(cities: City[], now = new Date()): City | null {
  let tz = ''
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone } catch { /* ignore */ }
  const exact = cities.find((c) => c.timezone === tz)
  if (exact) return exact
  const here = -now.getTimezoneOffset()
  const hereLng = (here / 60) * 15
  const scored = cities.map((c) => ({ c, d: Math.abs(tzOffsetMinutes(now, c.timezone) - here), l: Math.abs(c.lng - hereLng) }))
  scored.sort((a, b) => a.d - b.d || a.l - b.l)
  return scored.length && scored[0].d <= 180 ? scored[0].c : null
}

/** Grouping order for "now in the world". */
export const WORLD_ORDER: Period[] = ['golden', 'dusk', 'night', 'dawn', 'morning', 'midday', 'afternoon']
export const WORLD_LABEL: Record<Period, string> = {
  golden: 'golden hour now', dusk: 'dusk', night: 'night', dawn: 'dawn', morning: 'morning', midday: 'midday', afternoon: 'afternoon',
}

export interface WorldEntry { city: City; sun: SunInfo; next: string | null; minutes: number | null }
export interface World { list: WorldEntry[]; byCity: Map<string, WorldEntry> }

let worldKey = -1
let worldVal: World | null = null

/**
 * Every city's sun for the current minute, computed once and shared. Both the sky list and the find
 * panel need it, and the find panel re-renders on every keystroke — without this, typing would
 * recompute 43 solar positions per letter.
 */
export function worldNow(list: City[], now: Date): World {
  const key = Math.floor(now.getTime() / 60000)
  if (worldVal && key === worldKey) return worldVal
  const entries = list.map((city) => {
    const sun = sunInfo(now, city)
    return { city, sun, next: nextEvent(sun), minutes: nextEventMinutes(sun) }
  })
  worldKey = key
  worldVal = { list: entries, byCity: new Map(entries.map((e) => [e.city.slug, e])) }
  return worldVal
}
