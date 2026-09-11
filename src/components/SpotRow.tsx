import type { City, LatLng, Spot } from '../types'
import { becauseLine, type Context, type Ranked } from '../lib/rank'
import { bearingDeg, compassLabel, distanceKm, formatDistance, walkingTime } from '../lib/geo'
import { formatClock, type SunInfo } from '../lib/time'
import { actions, useStore } from '../store'
import { getGlobe } from '../globe/handle'

interface Props {
  ranked: Ranked
  city: City
  now: Date
  sun: SunInfo
  ctx: Context
  origin: LatLng | null
  originIsReal: boolean
  index: number
  onHot?: (id: string | null) => void
}

const WALK_M_PER_MIN = 80

export function walkMinutes(km: number) { return Math.round((km * 1000) / WALK_M_PER_MIN) }

/** A text row separated by hairlines (spec §6.8). */
export function SpotRow({ ranked, city, now, sun, ctx, origin, originIsReal, index, onHot }: Props) {
  const units = useStore((s) => s.units)
  const heading = useStore((s) => s.heading)
  const vibes = useStore((s) => s.vibes)
  const s = ranked.spot
  const from = origin ?? city
  const km = distanceKm(from, s)
  const walk = walkMinutes(km)
  const bearing = bearingDeg(from, s)
  const night = sun.period === 'night' || sun.period === 'dusk'
  const reason = becauseLine(ranked, ctx, units)
  const status: string[] = []
  let good = false
  if (ranked.hours?.confidence === 'high') {
    status.push(ranked.hours.status === 'open' ? 'open now' : 'closed now')
    if (ranked.hours.status === 'open') good = true
  } else status.push('see hours')
  status.push(originIsReal ? walkingTime(km) : `~${walk} min from centre`)
  if ((s.vibes.includes('sunset') || s.bestTimes.includes('golden-hour')) && sun.sunset && sun.period !== 'night') {
    const arriveMin = Math.round((sun.sunset.getTime() - now.getTime()) / 60000) - walk
    if (arriveMin > 0 && arriveMin < 240) { status.push(`arrive ${arriveMin} min before sunset`); good = good || ranked.hours?.status !== 'closed' }
  }
  return (
    <li>
      <a className={`row${index < 12 ? ' is-settling' : ''}`} style={{ '--i': index } as React.CSSProperties} href={`#/s/${s.id}`}
        onClick={(e) => { e.preventDefault(); actions.openSpot(s.id) }}
        onPointerEnter={() => onHot?.(s.id)} onPointerLeave={() => onHot?.(null)} onFocus={() => onHot?.(s.id)} onBlur={() => onHot?.(null)}>
        <span className="row-name">{s.name}</span>
        <span className="row-right" aria-hidden="true">
          {originIsReal ? (
            <>
              {formatDistance(km, units)}
              <svg className="needle" width="12" height="12" viewBox="0 0 12 12" style={{ transform: `rotate(${bearing - (heading ?? 0)}deg)` }}><line x1="6" y1="11" x2="6" y2="1" /><line x1="6" y1="1" x2="4" y2="3.5" /><line x1="6" y1="1" x2="8" y2="3.5" /></svg>
            </>
          ) : `~${walk} min from centre`}
        </span>
        <span className="vh">{originIsReal ? `${compassLabel(bearing).replace('N', 'north').replace('S', 'south').replace('E', 'east').replace('W', 'west').toLowerCase()}, ${formatDistance(km, units)}, ${walk} min walk` : `about ${walk} minutes from the centre`}</span>
        <span className="row-meta">
          <span>{[s.neighborhood, s.category, s.indoor ? 'indoor' : 'outdoor'].filter(Boolean).join(' · ')}</span>
        </span>
        <span className="row-right">
          <span className="meter" aria-hidden="true">{[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= s.lowkeyScore ? 'on' : ''} />)}</span>
          <span className="vh">low-key {s.lowkeyScore} of 5</span>
        </span>
        <span className="row-vibes">
          {s.vibes.map((v) => <span key={v} className={vibes.includes(v) ? 'hit' : ''}>{v}</span>)}
        </span>
        <span className="row-right">
          {s.safety.level === 'caution' && <span className="caution-word">{night ? 'caution after dark' : 'caution'}</span>}
          {s.safety.level === 'caution' && <span className="vh">caution: {s.safety.note}</span>}
        </span>
        {reason && <span className="row-reason">{reason}</span>}
        <span className={`row-status${good ? ' is-good' : ''}`}>{status.join(' · ')}{ranked.hours?.confidence === 'high' && ranked.hours.status === 'closed' && s.hours ? ` · ${s.hours}` : ''}</span>
      </a>
    </li>
  )
}

export function leaveBy(sun: SunInfo, walk: number, timeZone: string): string | null {
  if (!sun.sunset) return null
  const t = sun.sunset.getTime() - (walk + 10) * 60000
  if (t < Date.now()) return null
  return formatClock(new Date(t), timeZone)
}

export function focusGlobeTick(city: City, spot: Spot | null) {
  getGlobe()?.setTick(spot ? city : null, spot ? bearingDeg(city, spot) : null)
}
