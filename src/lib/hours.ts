/**
 * Hours confidence (DESIGN §6.10). Turns a free-text `hours` string into an open/closed verdict for one instant,
 * evaluated in the spot's time zone. Only fully understood schedules get `confidence: 'high'`; anything hedged,
 * partial or unrecognised is `unknown` / `low`, and the UI then prints `see hours`.
 */
export type HoursStatus = {
  status: 'open' | 'closed' | 'unknown'
  confidence: 'high' | 'low'
  closesInMin?: number
  opensInMin?: number
}

type Sun = { sunrise: Date | null; sunset: Date | null }
type SunMin = { sunrise: number | null; sunset: number | null }
type Range = [number, number] // minutes since local midnight; end > 1440 when the range crosses midnight
type Time = { min: number; h: number | null; mer?: string } // h/mer kept for 12h inference ("7-10pm", "9-5")
type Schedule = { ranges: Range[][]; closed: boolean[]; allDay: boolean[] } // indexed by weekday, 0 = Sunday

const UNKNOWN: HoursStatus = { status: 'unknown', confidence: 'low' }
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_NAMES = WEEKDAYS.map((d) => d.toLowerCase())
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const DAY = '(?:mon|tue|wed|thu|fri|sat|sun)'
const DAYS = `(?:daily|weekdays|weekends|${DAY}(?:-${DAY})?(?:(?:\\s*[&/]\\s*|\\s+and\\s+)${DAY}(?:-${DAY})?)*)`
const ONLY_DAYS = new RegExp(`^${DAYS}$`)
const CLOSED = new RegExp(`^(?:closed(?:\\s+on)?(?:\\s+(${DAYS}))?|(${DAYS})\\s+closed)$`)
const SEGMENT = new RegExp(`^(?:(${DAYS})\\s+)?(.+)$`)

/** Local weekday (0 = Sunday) and minutes since midnight of an instant in a zone; null if either is invalid. */
function local(date: Date, timeZone: string): { day: number; min: number } | null {
  if (Number.isNaN(date.getTime())) return null
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: 'numeric', hour12: false, weekday: 'short' })
    const parts = fmt.formatToParts(date)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
    const day = WEEKDAYS.indexOf(get('weekday'))
    return day < 0 ? null : { day, min: (Number(get('hour')) % 24) * 60 + Number(get('minute')) }
  } catch {
    return null
  }
}

/** Lower-case, drop parenthetical remarks, and fold the many spellings into one canonical vocabulary. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[‒–—−]/g, '-')
    .replace(/\b24\s*(?:\/\s*7|h(?:(?:ou)?rs?)?)(?:\s+a\s+day)?\b|\balways\s+open\b/g, '24h')
    .replace(/\b(?:dawn|first\s+light)\b/g, 'sunrise')
    .replace(/\bdusk\b/g, 'sunset')
    .replace(/\b12\s*(noon|midnight)\b/g, '$1')
    .replace(/(?<![a-z])([ap])\.?m\b\.?/g, '$1m')
    .replace(/\b(mon|tue|wed|thu|fri|sat|sun)(?:day|sday|nesday|rsday|urday|rs|r|s)?s?\b/g, '$1')
    .replace(/\b(?:every\s*day|all\s+week|7\s+days(?:\s+a\s+week)?)\b/g, 'daily')
    .replace(/\bopen\b/g, ' ')
    .replace(/\s+(?:to|through|thru)\s+/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseTime(s: string, sun: SunMin): Time | null {
  if (s === 'noon') return { min: 720, h: null }
  if (s === 'midnight') return { min: 0, h: null }
  if (s === 'sunrise' || s === 'sunset') return sun[s] === null ? null : { min: sun[s], h: null }
  const m = /^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?$/.exec(s)
  if (!m) return null
  const h = Number(m[1]), mm = Number(m[2] ?? 0), mer = m[3]
  if (h > 24 || mm > 59 || (h === 24 && mm > 0) || (mer && h > 12)) return null
  const h24 = mer === 'am' && h === 12 ? 0 : mer === 'pm' && h < 12 ? h + 12 : h
  return { min: h24 * 60 + mm, h, mer }
}

function parseRange(body: string, sun: SunMin): Range | null {
  const parts = body.split('-')
  if (parts.length !== 2) return null
  const a = parseTime(parts[0], sun), b = parseTime(parts[1], sun)
  if (!a || !b) return null
  let start = a.min, end = b.min
  if (a.h !== null && b.h !== null) {
    // "7-10pm" → the start borrows the end's meridiem; "9-5" → an unmarked end below the start is afternoon.
    if (!a.mer && b.mer && a.h <= 12 && a.h < b.h && b.h !== 12) start = ((a.h % 12) + (b.mer === 'pm' ? 12 : 0)) * 60 + (a.min % 60)
    else if (!a.mer && !b.mer && a.h <= 12 && b.h <= 12 && end <= start) end += 720
  }
  if (end <= start) end += 1440 // crosses midnight ("10am-2am", "noon-midnight")
  return [start, end]
}

function parseDays(spec: string): number[] {
  if (spec === 'daily') return ALL_DAYS
  if (spec === 'weekdays') return [1, 2, 3, 4, 5]
  if (spec === 'weekends') return [0, 6]
  const days: number[] = []
  for (const item of spec.split(/\s*[&/]\s*|\s+and\s+/)) {
    const [from, to = from] = item.split('-').map((d) => DAY_NAMES.indexOf(d))
    if (from < 0 || to < 0) continue
    for (let d = from; ; d = (d + 1) % 7) {
      days.push(d)
      if (d === to) break
    }
  }
  return days
}

/** Every comma/semicolon chunk must parse, otherwise the whole string is not understood (null). */
function parseSchedule(text: string, sun: SunMin): Schedule | null {
  const s: Schedule = { ranges: ALL_DAYS.map(() => []), closed: ALL_DAYS.map(() => false), allDay: ALL_DAYS.map(() => false) }
  const chunks = text.split(/\s*[;,]\s*/).filter(Boolean)
  if (!chunks.length) return null
  let carried: number[] | null = null // "Mon, Wed 9-5": a bare day list applies to the next chunk
  const scope = (spec: string | undefined) => (spec ? [...(carried ?? []), ...parseDays(spec)] : (carried ?? ALL_DAYS))
  for (const chunk of chunks) {
    const closed = CLOSED.exec(chunk)
    if (closed) {
      for (const d of scope(closed[1] ?? closed[2])) s.closed[d] = true
    } else if (ONLY_DAYS.test(chunk)) {
      carried = scope(chunk)
      continue
    } else {
      const m = SEGMENT.exec(chunk) as RegExpExecArray
      const days = scope(m[1])
      if (m[2] === '24h') for (const d of days) s.allDay[d] = true
      else {
        const range = parseRange(m[2], sun)
        if (!range) return null
        // Two alternative windows for one day (seasonal or otherwise) are not a schedule we understand.
        for (const d of days) {
          if (s.ranges[d].some(([a, b]) => range[0] < b && a < range[1])) return null
          s.ranges[d].push(range)
        }
      }
    }
    carried = null
  }
  if (carried !== null) return null // a bare day list with no time range is not a schedule
  return s
}

function merge(ranges: Range[]): Range[] {
  const out: Range[] = []
  for (const [start, end] of [...ranges].sort((x, y) => x[0] - y[0])) {
    const last = out[out.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else out.push([start, end])
  }
  return out
}

function evaluate(s: Schedule, day: number, min: number): HoursStatus {
  if (s.closed[day]) return { status: 'closed', confidence: 'high' }
  if (s.allDay[day]) return { status: 'open', confidence: 'high' }
  const yesterday = (day + 6) % 7
  const spill: Range[] = s.closed[yesterday] ? [] : s.ranges[yesterday].filter(([, e]) => e > 1440).map(([a, e]) => [a - 1440, e - 1440])
  const merged = merge([...spill, ...s.ranges[day]])
  const current = merged.find(([a, e]) => min >= a && min < e)
  if (current) return { status: 'open', confidence: 'high', closesInMin: current[1] - min }
  const next = merged.find(([a]) => a > min)
  return next ? { status: 'closed', confidence: 'high', opensInMin: next[0] - min } : { status: 'closed', confidence: 'high' }
}

/**
 * `now` is an absolute instant, evaluated in `timeZone`. `sun` (e.g. a `SunInfo`) resolves `dawn–dusk` /
 * `sunrise to sunset`; without it those read as unknown. Never throws on garbage input.
 */
/**
 * Seasonal qualifiers mean the posted times change through the year, and the string only ever encodes
 * one season. Guessing here produces a confident wrong "open now", so these read as unknown instead.
 */
const SEASONAL = /\b(?:winter|summer|spring|autumn|fall|seasonal(?:ly)?|by season|shorter|longer|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i

export function parseHours(text: string, now: Date, timeZone: string, sun?: Sun): HoursStatus {
  const raw = String(text ?? '')
  if (SEASONAL.test(raw)) return UNKNOWN
  const here = local(now, timeZone)
  if (!here) return UNKNOWN
  const sunMin: SunMin = {
    sunrise: sun?.sunrise ? (local(sun.sunrise, timeZone)?.min ?? null) : null,
    sunset: sun?.sunset ? (local(sun.sunset, timeZone)?.min ?? null) : null,
  }
  const schedule = parseSchedule(normalise(raw), sunMin)
  return schedule ? evaluate(schedule, here.day, here.min) : UNKNOWN
}
