import { useState } from 'react'
import { cities } from '../data'
import { actions, GEO_DENIED_KEY, loadLS, useStore } from '../store'
import { distanceKm, formatDistance } from '../lib/geo'
import { getGlobe } from '../globe/handle'
import type { City } from '../types'

interface Props { onChooseCity: () => void }

export function nearestCity(pos: { lat: number; lng: number }): { city: City; km: number } {
  let best: City = cities[0], bestKm = Infinity
  for (const c of cities) { const d = distanceKm(pos, c); if (d < bestKm) { bestKm = d; best = c } }
  return { city: best, km: bestKm }
}

/** `around me` on the Sky: ask once, on this device, only on `continue` (spec §6.6). */
export function AroundYou({ onChooseCity }: Props) {
  const status = useStore((s) => s.geoStatus)
  const pos = useStore((s) => s.userPos)
  const units = useStore((s) => s.units)
  const [asking, setAsking] = useState(false)
  const [far, setFar] = useState<{ city: City; km: number } | null>(null)
  if (status === 'unsupported' || !window.isSecureContext) return null

  const locate = () => {
    setAsking(false)
    actions.setUserPos(null, 'asking')
    actions.note('looking once…')
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude }
        actions.setUserPos(here, 'granted', p.coords.accuracy)
        const near = nearestCity(here)
        const g = getGlobe()
        if (g) await g.flyTo(here.lat, here.lng, 1.2, 2000)
        if (near.km <= 80) {
          setFar(null)
          if (g) g.select(near.city.slug); else actions.openCity(near.city.slug)
        } else {
          setFar(near)
          actions.note(`The nearest city we know is ${near.city.name}, ${formatDistance(near.km, units)} away.`)
        }
      },
      () => { actions.setUserPos(null, 'denied'); actions.note('no location — that is fine'); onChooseCity() },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  }
  const denied = status === 'denied' || loadLS<number>(GEO_DENIED_KEY, 0) === 1

  if (far) {
    return (
      <div className="words" style={{ justifyContent: 'center' }}>
        <span className="small">The nearest city we know is {far.city.name}, {formatDistance(far.km, units)} away.</span>
        <button type="button" className="word" onClick={() => { getGlobe()?.select(far.city.slug) ?? actions.openCity(far.city.slug) }}>open {far.city.name}</button>
        <button type="button" className="word word--quiet" onClick={onChooseCity}>choose another</button>
      </div>
    )
  }
  if (asking) {
    return (
      <div className="words" style={{ justifyContent: 'center' }}>
        <span className="small">We look at your location once, on this device. Nothing leaves it.</span>
        <button type="button" className="word" onClick={locate}>continue</button>
        <button type="button" className="word word--quiet" onClick={() => setAsking(false)}>not now</button>
      </div>
    )
  }
  return (
    <div className="words" style={{ justifyContent: 'center', gap: '10px 28px' }}>
      <button type="button" className="word" disabled={status === 'asking'} onClick={() => (pos ? locate() : denied ? locate() : setAsking(true))}>{status === 'asking' ? 'looking once…' : denied ? 'try again' : pos ? 'around me' : 'around me'}</button>
      <button type="button" className="word" onClick={onChooseCity}>choose a city</button>
    </div>
  )
}
