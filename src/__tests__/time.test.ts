import { describe, expect, it } from 'vitest'
import { formatCountdown, sunInfo } from '../lib/time'

const NYC = { lat: 40.7128, lng: -74.006 }

describe('sunInfo', () => {
  it('classifies midday, golden hour and night in New York', () => {
    expect(sunInfo(new Date('2026-06-21T16:00:00Z'), NYC).period).toBe('midday') // noon EDT
    const golden = sunInfo(new Date('2026-06-21T23:55:00Z'), NYC) // ~19:55 EDT, sunset ≈ 20:30
    expect(golden.period).toBe('golden')
    expect(golden.minutesToGolden).toBe(0)
    expect(golden.minutesToSunset).toBeGreaterThan(20)
    expect(golden.minutesToSunset).toBeLessThan(50)
    const night = sunInfo(new Date('2026-06-22T05:00:00Z'), NYC) // 1am EDT
    expect(night.period).toBe('night')
    expect(night.daylight).toBe(0)
  })
  it('falls back to clock-based periods near the poles in summer', () => {
    const info = sunInfo(new Date('2026-06-21T12:00:00Z'), { lat: 78.2, lng: 15.6 })
    expect(info.polar).toBe(true)
    expect(['morning', 'midday', 'afternoon']).toContain(info.period)
  })
  it('formats countdowns', () => {
    expect(formatCountdown(0)).toBe('now')
    expect(formatCountdown(45)).toBe('45 min')
    expect(formatCountdown(125)).toBe('2h 5m')
  })
})

import { instantAtLocalMinutes, localMinutes } from '../lib/time'

describe('instantAtLocalMinutes', () => {
  it('lands on the requested wall-clock minute across a DST change', () => {
    // Lisbon leaves summer time on 2026-10-25 at 02:00 WEST -> 01:00 WET
    const base = new Date('2026-10-25T10:00:00Z') // 10:00 WET
    const t = instantAtLocalMinutes(base, 'Europe/Lisbon', 30) // 00:30 local, before the change
    expect(localMinutes(t, 'Europe/Lisbon')).toBe(30)
    const u = instantAtLocalMinutes(new Date('2026-06-10T09:00:00Z'), 'Asia/Tokyo', 21 * 60 + 30)
    expect(localMinutes(u, 'Asia/Tokyo')).toBe(21 * 60 + 30)
  })
  it('treats the last 90 minutes before sunset as golden hour', () => {
    const info = sunInfo(new Date('2026-09-10T10:00:00Z'), { lat: 1.35, lng: 103.82 }) // Singapore 18:00, sunset ≈ 19:05
    expect(info.period).toBe('golden')
  })
})
