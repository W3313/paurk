import { useMemo } from 'react'
import type { City, LatLng, Spot } from '../types'
import { rankSpots, vibeCounts, type Context } from '../lib/rank'
import type { SunInfo } from '../lib/time'
import { parseHours } from '../lib/hours'
import { useStore } from '../store'
import { SpotRow } from './SpotRow'

interface Props {
  city: City
  spots: Spot[]
  now: Date
  sun: SunInfo
  origin: LatLng | null
  originIsReal: boolean
  onHot?: (id: string | null) => void
}

export function useRankContext(city: City, now: Date, sun: SunInfo, origin: LatLng | null): Context {
  const vibes = useStore((s) => s.vibes)
  const weather = useStore((s) => s.weather)
  return useMemo<Context>(() => ({
    period: sun.period,
    raining: !!weather?.isRaining,
    snowing: !!weather?.isSnowing,
    cold: !!weather && weather.tempC < 5,
    vibes,
    origin,
    hours: (spot) => parseHours(spot.hours, now, city.timezone, { sunrise: sun.sunrise, sunset: sun.sunset }),
  }), [sun, weather, vibes, origin, now, city.timezone])
}

/** The ranked list; at night caution spots sink below `better in daylight` (spec §6.11). */
export function SpotList({ city, spots, now, sun, origin, originIsReal, onHot }: Props) {
  const ctx = useRankContext(city, now, sun, origin)
  const vibes = useStore((s) => s.vibes)
  const filtered = useMemo(() => spots.filter((s) => vibes.every((v) => s.vibes.includes(v))), [spots, vibes])
  const ranked = useMemo(() => rankSpots(filtered, ctx), [filtered, ctx])
  if (!spots.length) return <p className="empty">Nothing here yet.</p>
  if (!ranked.length) return <p className="empty">Nothing matches {vibes.join(' + ')} here right now — loosen a word.</p>
  const common = vibeCounts(ranked)
  const night = sun.period === 'night'
  const main = night ? ranked.filter((r) => r.spot.safety.level !== 'caution') : ranked
  const later = night ? ranked.filter((r) => r.spot.safety.level === 'caution') : []
  let i = 0
  return (
    <>
      <ul className="rows" role="list">
        {main.map((r) => <SpotRow key={r.spot.id} ranked={r} city={city} now={now} sun={sun} ctx={ctx} origin={origin} originIsReal={originIsReal} index={i++} onHot={onHot} common={common} />)}
      </ul>
      {later.length > 0 && (
        <>
          <h3 className="group-head">better in daylight · {later.length}</h3>
          <ul className="rows" role="list">
            {later.map((r) => <SpotRow key={r.spot.id} ranked={r} city={city} now={now} sun={sun} ctx={ctx} origin={origin} originIsReal={originIsReal} index={i++} onHot={onHot} common={common} />)}
          </ul>
        </>
      )}
    </>
  )
}
