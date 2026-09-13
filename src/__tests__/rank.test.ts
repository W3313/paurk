import { describe, expect, it } from 'vitest'
import { becauseLine, rankSpots, vibeCounts } from '../lib/rank'
import { layoutRadar } from '../lib/radar'
import type { Spot, Vibe } from '../types'
import dataset from '../data/spots.json'

const base: Spot = {
  id: 'x/a', city: 'x', name: 'A', neighborhood: '', category: 'park', vibes: ['quiet'],
  bestTimes: ['afternoon'], indoor: false, free: true, hours: '24h', lat: 0, lng: 0, coordConfidence: 'high',
  wikipediaTitle: null, sourceCount: 0, safety: { level: 'ok', note: '' }, lowkeyScore: 3, verified: true,
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

describe('becauseLine', () => {
  const ctx = { period: 'night' as const, raining: false, vibes: [], origin: null }
  const line = (s: Spot, c = ctx, common?: Map<Vibe, number>) => becauseLine(rankSpots([s], c)[0], c, 'metric', common)

  it('names the spot, not just the hour', () => {
    expect(line(pier)).toBe('because it is late and this has the view')
    const water: Spot = { ...pier, id: 'x/w', vibes: ['water', 'night'] }
    expect(line(water)).toBe('because it is late and this is on the water')
  })

  it('keeps verified-open ahead of anything the vibes could say', () => {
    const bar: Spot = { ...base, id: 'x/i', indoor: true, vibes: ['cozy', 'night'], bestTimes: ['night'] }
    const open = { ...ctx, hours: () => ({ status: 'open' as const, confidence: 'high' as const }) }
    expect(line(bar, open)).toBe('because it is late and this is indoors and open')
    expect(line(bar)).toBe('because it is late and this is somewhere to settle into')
  })

  /*
   * The lead clause is the city's clock, so it is the same for every row; if the tail is fixed per
   * period too, a list prints one sentence thirteen times. Counting what the rows on screen share lets
   * the tail reach past the trait they have in common — every place in Dubai is on the water.
   */
  it('reaches past the trait the whole list shares', () => {
    const a: Spot = { ...base, id: 'x/1', vibes: ['water', 'skyline', 'night'], bestTimes: ['night'] }
    const b: Spot = { ...base, id: 'x/2', vibes: ['water', 'cozy', 'night'], bestTimes: ['night'] }
    const ranked = rankSpots([a, b], ctx)
    const common = vibeCounts(ranked)
    const lines = ranked.map((r) => becauseLine(r, ctx, 'metric', common))
    expect(new Set(lines).size).toBe(2)
    expect(lines.every((l) => l?.includes('on the water'))).toBe(false)
  })

  it('never prints one sentence down a whole real city list', () => {
    const byCity = new Map<string, Spot[]>()
    for (const s of dataset.spots as unknown as Spot[]) byCity.set(s.city, [...(byCity.get(s.city) ?? []), s])
    const flat: string[] = []
    for (const period of ['night', 'golden', 'morning', 'afternoon', 'midday'] as const) {
      const c = { period, raining: false, vibes: [], origin: null }
      for (const [, list] of byCity) {
        if (list.length < 5) continue
        const ranked = rankSpots(list, c)
        const common = vibeCounts(ranked)
        const said = ranked.map((r) => becauseLine(r, c, 'metric', common)).filter(Boolean) as string[]
        if (said.length >= 5) flat.push(`${new Set(said).size}/${said.length}`)
        expect(said.length < 5 || new Set(said).size).not.toBe(1)
      }
    }
    expect(flat.length).toBeGreaterThan(100)
  })
})
