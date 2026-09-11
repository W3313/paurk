import type { LatLng } from '../types'

const R_KM = 6371
const toRad = (d: number) => (d * Math.PI) / 180
const toDeg = (r: number) => (r * 180) / Math.PI

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Initial bearing from a to b, degrees clockwise from north (0..360). */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat), φ2 = toRad(b.lat), Δλ = toRad(b.lng - a.lng)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
export function compassLabel(bearing: number): string {
  return COMPASS[Math.round(bearing / 45) % 8]
}

export function formatDistance(km: number, units: 'metric' | 'imperial' = 'metric'): string {
  if (units === 'imperial') {
    const mi = km * 0.621371
    if (mi < 0.1) return `${Math.round(mi * 5280)} ft`
    return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`
  }
  if (km < 1) return `${Math.round(km * 1000)} m`
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`
}

/** Rough walking time at 4.8 km/h, as a short human string. */
export function walkingTime(km: number): string {
  const min = Math.round((km / 4.8) * 60)
  if (min < 1) return 'right here'
  if (min < 60) return `${min} min walk`
  if (min < 60 * 3) return `${Math.round(min / 60 * 10) / 10} h walk`
  return 'too far to walk'
}

/** Local equirectangular projection around an origin: returns km east/north. */
export function localOffsetKm(origin: LatLng, p: LatLng): { east: number; north: number } {
  const north = (p.lat - origin.lat) * 111.32
  const east = (p.lng - origin.lng) * 111.32 * Math.cos(toRad((origin.lat + p.lat) / 2))
  return { east, north }
}

/** Unit-sphere position for a lat/lng using the y-up globe convention shared with the globe engine. */
export function latLngToVec3(lat: number, lng: number, r = 1): [number, number, number] {
  const phi = toRad(90 - lat)
  const theta = toRad(lng + 180)
  return [-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)]
}

/**
 * Sub-solar point (where the sun is directly overhead) for a date. Approximate
 * (±1°), good enough to draw the day/night terminator on a globe.
 */
export function subsolarPoint(date: Date): LatLng {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const dayOfYear = (date.getTime() - start) / 86400000
  const g = toRad((360 / 365.25) * (dayOfYear - 81))
  const declination = 23.44 * Math.sin(g)
  const eqTimeMin = 9.87 * Math.sin(2 * g) - 7.53 * Math.cos(g) - 1.5 * Math.sin(g)
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  let lng = -15 * (utcHours - 12 + eqTimeMin / 60)
  lng = ((lng + 540) % 360) - 180
  return { lat: declination, lng }
}
