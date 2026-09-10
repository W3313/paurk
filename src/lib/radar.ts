import type { LatLng, Spot } from '../types'
import { bearingDeg, distanceKm } from './geo'

export interface RadarPoint { spot: Spot; x: number; y: number; km: number; bearing: number; ring: number }

/**
 * Lays spots out around an origin as a "radar": angle = compass bearing, radius = distance on a
 * square-root scale so nearby spots do not pile up in the centre. Returns unit coordinates (-1..1).
 */
export function layoutRadar(origin: LatLng, list: Spot[], maxKm?: number): { points: RadarPoint[]; maxKm: number; rings: number[] } {
  const raw = list.map((spot) => ({ spot, km: distanceKm(origin, spot), bearing: bearingDeg(origin, spot) }))
  const far = maxKm ?? Math.max(1, ...raw.map((r) => r.km)) * 1.08
  const points = raw.map((r) => {
    const rr = Math.min(1, Math.sqrt(r.km / far))
    const a = ((r.bearing - 90) * Math.PI) / 180
    return { ...r, x: Math.cos(a) * rr, y: Math.sin(a) * rr, ring: rr }
  })
  // three labelled rings at "nice" distances
  const nice = [0.5, 1, 2, 3, 5, 8, 10, 15, 20, 30, 50, 80, 120, 200, 300, 500, 1000]
  const rings = nice.filter((n) => n < far * 0.95).slice(-3)
  return { points, maxKm: far, rings }
}
