import { describe, expect, it } from 'vitest'
import { rankSpots } from '../lib/rank'
import { layoutRadar } from '../lib/radar'
import type { Spot } from '../types'

const base: Spot = {
  id: 'x/a', city: 'x', name: 'A', neighborhood: '', category: 'park', vibes: ['quiet'], blurb: '', tips: '',
  bestTimes: ['afternoon'], indoor: false, free: true, hours: '24h', lat: 0, lng: 0, coordConfidence: 'high',
  wikipediaTitle: null, sources: [], safety: { level: 'ok', note: '' }, lowkeyScore: 3, verified: true,
}
const park = { ...base }
const cafe: Spot = { ...base, id: 'x/b', name: 'B', category: 'cafe', indoor: true, vibes: ['cozy', 'rain-ok'], lat: 0.01, lng: 0.01 }
const pier: Spot = { ...base, id: 'x/c', name: 'C', category: 'waterfront', vibes: ['sunset', 'view', 'night'], bestTimes: ['golden-hour', 'night'], lat: 0.05, lng: 0 }
const sketchy: Spot = { ...base, id: 'x/d', name: 'D', vibes: ['night'], bestTimes: ['night'], safety: { level: 'caution', note: 'dim after 10pm' } }

describe('rankSpots', () => {
  it('floats rain-proof spots up in the rain', () => {
    const r = rankSpots([park, cafe, pier], { period: 'afternoon', raining: true, vibes: [], origin: null })
    expect(r[0].spot.id).toBe('x/b')
    expect(r[0].reasons).toContain('rain')
  })
  it('prefers golden-hour spots at golden hour', () => {
    const r = rankSpots([park, cafe, pier], { period: 'golden', raining: false, vibes: [], origin: null })
    expect(r[0].spot.id).toBe('x/c')
  })
  it('penalises caution spots at night', () => {
    const r = rankSpots([pier, sketchy], { period: 'night', raining: false, vibes: [], origin: null })
    expect(r[0].spot.id).toBe('x/c')
  })
  it('rewards chosen vibes and nearby spots', () => {
    const r = rankSpots([park, cafe], { period: 'afternoon', raining: false, vibes: ['cozy'], origin: { lat: 0.01, lng: 0.01 } })
    expect(r[0].spot.id).toBe('x/b')
    expect(r[0].km).toBeLessThan(0.01)
  })
})

describe('layoutRadar', () => {
  it('keeps points inside the unit circle and maps bearing to angle', () => {
    const { points, rings } = layoutRadar({ lat: 0, lng: 0 }, [park, cafe, pier])
    for (const p of points) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(1.0001)
    const north = points.find((p) => p.spot.id === 'x/c')!
    expect(north.y).toBeLessThan(0) // north is up (negative y)
    expect(Math.abs(north.x)).toBeLessThan(1e-6)
    expect(rings.length).toBeGreaterThan(0)
  })
})

describe('night weights', () => {
  it('gives stargaze the full night bonus, without stacking on night', () => {
    const stars: Spot = { ...base, id: 'x/s', vibes: ['stargaze'], bestTimes: ['golden-hour'] }
    const nightStars: Spot = { ...base, id: 'x/n', vibes: ['night', 'stargaze'], bestTimes: ['night'] }
    const ctx = { period: 'night' as const, raining: false, vibes: [], origin: null }
    const a = rankSpots([stars], ctx)[0]
    expect(a.reasons).toContain('stargaze')
    expect(a.score).toBeCloseTo(1.8 + 3 - 2)
    const b = rankSpots([nightStars], ctx)[0]
    expect(b.reasons).toContain('night')
    expect(b.reasons).not.toContain('stargaze')
    expect(b.score).toBeCloseTo(1.8 + 3)
  })
})
