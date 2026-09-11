import { describe, expect, it } from 'vitest'
import { parseHours } from '../lib/hours'

// Lisbon is UTC+1 (WEST) in September 2026. 2026-09-10 is a Thursday.
const TZ = 'Europe/Lisbon'
const THU_1930 = new Date('2026-09-10T18:30:00Z')
const THU_0630 = new Date('2026-09-10T05:30:00Z')
const THU_1200 = new Date('2026-09-10T11:00:00Z')
const FRI_0130 = new Date('2026-09-11T00:30:00Z')
const FRI_0300 = new Date('2026-09-11T02:00:00Z')
const SAT_1930 = new Date('2026-09-12T18:30:00Z')
const SUN_1200 = new Date('2026-09-13T11:00:00Z')
const MON_1200 = new Date('2026-09-14T11:00:00Z')
const SUN = { sunrise: new Date('2026-09-10T06:15:00Z'), sunset: new Date('2026-09-10T19:00:00Z') } // 07:15 / 20:00 local

const open = (closesInMin?: number) => ({ status: 'open', confidence: 'high', ...(closesInMin === undefined ? {} : { closesInMin }) })
const closed = (opensInMin?: number) => ({ status: 'closed', confidence: 'high', ...(opensInMin === undefined ? {} : { opensInMin }) })
const unknown = { status: 'unknown', confidence: 'low' }

describe('parseHours', () => {
  it('treats every always-open spelling as open with high confidence and no closing time', () => {
    for (const text of ['24h', '24 hours', '24/7', 'always open', 'open 24 hours', '24 hrs', '24h (unlit; best in daylight)', 'Daily 24h']) {
      expect(parseHours(text, THU_1930, TZ), text).toEqual(open())
    }
  })

  it('resolves dawn–dusk against the provided sun times', () => {
    expect(parseHours('dawn–dusk', THU_1930, TZ, SUN)).toEqual(open(30))
    expect(parseHours('sunrise to sunset', THU_1930, TZ, SUN)).toEqual(open(30))
    expect(parseHours('dawn to dusk', THU_0630, TZ, SUN)).toEqual(closed(45))
    expect(parseHours('sunrise–sunset', new Date('2026-09-10T19:30:00Z'), TZ, SUN)).toEqual(closed())
    expect(parseHours('dawn–dusk', THU_1930, TZ)).toEqual(unknown)
    expect(parseHours('dawn–dusk', THU_1930, TZ, { sunrise: SUN.sunrise, sunset: null })).toEqual(unknown)
  })

  it('evaluates a plain daily range: open with closesInMin, closed with opensInMin', () => {
    expect(parseHours('7am-10pm', THU_1930, TZ)).toEqual(open(150))
    expect(parseHours('7am-10pm', THU_0630, TZ)).toEqual(closed(30))
    expect(parseHours('7am-10pm', new Date('2026-09-10T21:30:00Z'), TZ)).toEqual(closed()) // 22:30, nothing later today
  })

  it('accepts 12h and 24h spellings, noon and midnight', () => {
    expect(parseHours('7:30 am–11 pm', THU_1930, TZ)).toEqual(open(210))
    expect(parseHours('07:00–22:00', THU_1930, TZ)).toEqual(open(150))
    expect(parseHours('0600-2300', THU_1930, TZ)).toEqual(open(210))
    expect(parseHours('noon to midnight', THU_1930, TZ)).toEqual(open(270))
    expect(parseHours('7 p.m. - 10 p.m.', THU_1930, TZ)).toEqual(open(150))
    expect(parseHours('7-10pm', THU_1930, TZ)).toEqual(open(150))
    expect(parseHours('12pm-12am', THU_1930, TZ)).toEqual(open(270))
  })

  it('handles ranges that cross midnight', () => {
    expect(parseHours('10am–2am', THU_1930, TZ)).toEqual(open(390))
    expect(parseHours('10am–2am', FRI_0130, TZ)).toEqual(open(30))
    expect(parseHours('10am–2am', FRI_0300, TZ)).toEqual(closed(420))
    expect(parseHours('Fri 10pm-2am', new Date('2026-09-12T00:30:00Z'), TZ)).toEqual(open(30)) // Sat 01:30, spilled from Fri
  })

  it('evaluates day-scoped schedules for the current weekday', () => {
    const text = 'Mon–Fri 08:00–20:00, Sat 10:00–18:00'
    expect(parseHours(text, THU_1930, TZ)).toEqual(open(30))
    expect(parseHours(text, SAT_1930, TZ)).toEqual(closed())
    expect(parseHours(text, new Date('2026-09-12T08:00:00Z'), TZ)).toEqual(closed(60)) // Sat 09:00
    expect(parseHours(text, SUN_1200, TZ)).toEqual(closed()) // unlisted day
    expect(parseHours('Tue-Sun 10am-6pm', SUN_1200, TZ)).toEqual(open(360))
    expect(parseHours('Tue-Sun 10am-6pm', MON_1200, TZ)).toEqual(closed())
    expect(parseHours('daily 6am–10pm', SUN_1200, TZ)).toEqual(open(600))
    expect(parseHours('weekdays 9-5', THU_1200, TZ)).toEqual(open(300))
    expect(parseHours('weekdays 9-5', THU_1930, TZ)).toEqual(closed())
    expect(parseHours('weekdays 9-5', SAT_1930, TZ)).toEqual(closed())
    expect(parseHours('Mon, Wed and Fri 10am-4pm', THU_1200, TZ)).toEqual(closed())
    expect(parseHours('Mon, Wed and Fri 10am-4pm', MON_1200, TZ)).toEqual(open(240))
  })

  it('marks a listed closed day as closed with high confidence', () => {
    expect(parseHours('closed Mon', MON_1200, TZ)).toEqual(closed())
    const text = 'Tue-Sun 10am-6pm; closed Mon (museum opens late on Thu; check site for Reading Room times)'
    expect(parseHours(text, MON_1200, TZ)).toEqual(closed())
    expect(parseHours(text, THU_1200, TZ)).toEqual(open(360))
    expect(parseHours('Mon-Fri 9-5, Sat-Sun closed', SUN_1200, TZ)).toEqual(closed())
  })

  it('unions several segments for the same day', () => {
    expect(parseHours('9am-12pm, 2pm-6pm', THU_1200, TZ)).toEqual(closed(120))
    expect(parseHours('9am-12pm, 12pm-8pm', THU_1200, TZ)).toEqual(open(480))
    expect(parseHours('Mon-Fri 9-5; Thu 5pm-9pm', THU_1930, TZ)).toEqual(open(90))
  })

  it('returns unknown with low confidence for anything it does not fully understand', () => {
    for (const text of [
      'varies (check site)', 'varies', 'see site', '', '   ', 'usually open until late', 'Daily approx 8am-8pm',
      '8am-7pm or dusk, whichever is earlier', 'Building daily approx 10am-11pm (check site); riverside walk 24h',
      '25:00-26:00', '9:75-10:00', '###', 'Mon-Fri 9-5, check site for holidays',
    ]) {
      expect(parseHours(text, THU_1930, TZ), JSON.stringify(text)).toEqual(unknown)
    }
  })

  it('evaluates the instant in the given time zone and never throws', () => {
    const late = new Date('2026-09-10T22:30:00Z') // 23:30 Lisbon, 18:30 New York
    expect(parseHours('7am-10pm', late, TZ)).toEqual(closed())
    expect(parseHours('7am-10pm', late, 'America/New_York')).toEqual(open(210))
    expect(parseHours('7am-10pm', late, 'Not/AZone')).toEqual(unknown)
    expect(parseHours('7am-10pm', new Date(NaN), TZ)).toEqual(unknown)
    expect(parseHours(undefined as unknown as string, THU_1930, TZ)).toEqual(unknown)
  })
})

describe('parseHours day-only schedules', () => {
  it('does not treat a bare day list as a schedule', () => {
    const now = new Date('2026-09-10T11:00:00Z')
    expect(parseHours('daily', now, 'Europe/Lisbon').confidence).toBe('low')
    expect(parseHours('Mon-Fri', now, 'Europe/Lisbon').confidence).toBe('low')
    expect(parseHours('Mon-Fri 9-5, Sat', now, 'Europe/Lisbon').confidence).toBe('low')
  })
})
