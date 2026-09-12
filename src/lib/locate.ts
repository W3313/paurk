import { cities } from '../data'
import { actions, GEO_DENIED_KEY, loadLS, getState } from '../store'
import { distanceKm, formatDistance } from './geo'
import { getGlobe } from '../globe/handle'
import type { City } from '../types'

export function nearestCity(pos: { lat: number; lng: number }): { city: City; km: number } {
  let best: City = cities[0], bestKm = Infinity
  for (const c of cities) { const d = distanceKm(pos, c); if (d < bestKm) { bestKm = d; best = c } }
  return { city: best, km: bestKm }
}

export function geoAvailable(): boolean {
  return getState().geoStatus !== 'unsupported' && typeof navigator !== 'undefined' && 'geolocation' in navigator && window.isSecureContext
}

/** True once the browser has refused us on this device, so the button can say so rather than re-ask blindly. */
export function geoDenied(): boolean {
  return getState().geoStatus === 'denied' || loadLS<number>(GEO_DENIED_KEY, 0) === 1
}

export interface LocateResult { city: City; km: number; near: boolean }

/**
 * Look at the location once, on this device, and fly the globe there. Resolves with the nearest city
 * we know and whether it is close enough to count as "here"; rejects if the browser refuses.
 * Callers own the consent step — this function assumes it has already been given (spec §6.6).
 */
export function locateOnce(): Promise<LocateResult> {
  return new Promise((resolve, reject) => {
    actions.setUserPos(null, 'asking')
    actions.note('looking once…')
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude }
        actions.setUserPos(here, 'granted', p.coords.accuracy)
        const { city, km } = nearestCity(here)
        const near = km <= 80
        // The flight is presentation: an interrupted one must not discard the position we just got.
        const g = getGlobe()
        if (g) await g.flyTo(here.lat, here.lng, 1.2, 2000)
        if (near) { if (g) g.select(city.slug); else actions.openCity(city.slug) }
        else actions.note(`The nearest city we know is ${city.name}, ${formatDistance(km, getState().units)} away.`)
        resolve({ city, km, near })
      },
      (err) => { actions.setUserPos(null, 'denied'); actions.note('no location — that is fine'); reject(err) },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  })
}
