import { describe, expect, it } from 'vitest'
import { bearingDeg, compassLabel, distanceKm, formatDistance, latLngToVec3, subsolarPoint, walkingTime } from '../lib/geo'

describe('geo', () => {
  it('measures the London–Paris distance within 1%', () => {
    const d = distanceKm({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 })
    expect(d).toBeGreaterThan(340)
    expect(d).toBeLessThan(347)
  })
  it('gives compass bearings', () => {
    expect(compassLabel(bearingDeg({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }))).toBe('N')
    expect(compassLabel(bearingDeg({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }))).toBe('E')
    expect(compassLabel(bearingDeg({ lat: 0, lng: 0 }, { lat: -1, lng: -1 }))).toBe('SW')
  })
  it('formats distances in both unit systems', () => {
    expect(formatDistance(0.4)).toBe('400 m')
    expect(formatDistance(2.34)).toBe('2.3 km')
    expect(formatDistance(1.6, 'imperial')).toBe('1.0 mi')
    expect(walkingTime(0.8)).toBe('10 min walk')
  })
  it('puts the north pole on +y and keeps points on the unit sphere', () => {
    const [x, y, z] = latLngToVec3(90, 0)
    expect(Math.abs(x)).toBeLessThan(1e-9)
    expect(y).toBeCloseTo(1)
    expect(Math.abs(z)).toBeLessThan(1e-9)
    const v = latLngToVec3(37.7, -122.4)
    expect(Math.hypot(...v)).toBeCloseTo(1)
  })
  it('puts the sub-solar point near the equator at the equinox and at 0° longitude at 12:00 UTC', () => {
    const p = subsolarPoint(new Date('2026-03-20T12:00:00Z'))
    expect(Math.abs(p.lat)).toBeLessThan(1.5)
    expect(Math.abs(p.lng)).toBeLessThan(3)
    const q = subsolarPoint(new Date('2026-06-21T00:00:00Z'))
    expect(q.lat).toBeGreaterThan(22)
    expect(Math.abs(Math.abs(q.lng) - 180)).toBeLessThan(4)
  })
})
