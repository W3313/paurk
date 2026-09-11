import { useEffect, useMemo, useRef, useState } from 'react'
import type { City, LatLng, Spot } from '../types'
import { actions, useStore } from '../store'
import { SpotImage } from './SpotImage'
import { TakeCare } from './TakeCare'
import { ShareWord } from './ShareWord'
import { BreatheOverlay } from './BreatheOverlay'
import { distanceKm, formatDistance, walkingTime } from '../lib/geo'
import { formatClock, formatCountdown, type SunInfo } from '../lib/time'
import { parseHours } from '../lib/hours'
import { walkMinutes, leaveBy, focusGlobeTick } from './SpotRow'

interface Props { spot: Spot; city: City; now: Date; sun: SunInfo; origin: LatLng | null; originIsReal: boolean; mobile: boolean }

const TIME_WORDS: Record<string, string> = { morning: 'morning', afternoon: 'afternoon', 'golden-hour': 'golden hour', night: 'night' }

export function SpotPage({ spot, city, now, sun, origin, originIsReal, mobile }: Props) {
  const saved = useStore((s) => s.savedIds.includes(spot.id))
  const units = useStore((s) => s.units)
  const still = useStore((s) => s.still)
  const nameRef = useRef<HTMLHeadingElement>(null)
  const [breathe, setBreathe] = useState(false)
  useEffect(() => { nameRef.current?.focus({ preventScroll: true }) }, [spot.id])
  useEffect(() => { focusGlobeTick(city, spot); return () => focusGlobeTick(city, null) }, [city, spot])

  const hours = useMemo(() => parseHours(spot.hours, now, city.timezone, { sunrise: sun.sunrise, sunset: sun.sunset }), [spot.hours, now, city.timezone, sun])
  const from = origin ?? city
  const km = distanceKm(from, spot)
  const walk = walkMinutes(km)
  const night = sun.period === 'night' || sun.period === 'dusk'
  const currentTime = sun.period === 'golden' ? 'golden-hour' : sun.period === 'night' || sun.period === 'dusk' ? 'night' : sun.period === 'dawn' || sun.period === 'morning' ? 'morning' : 'afternoon'
  const sunsetSpot = spot.vibes.includes('sunset') || spot.bestTimes.includes('golden-hour')

  const nowLine: string[] = []
  let good = false
  if (hours.confidence === 'high') { nowLine.push(hours.status === 'open' ? 'open now' : 'closed now'); good = hours.status === 'open' }
  if (sun.period === 'golden' && sun.minutesToSunset !== null) nowLine.push(`sunset in ${formatCountdown(sun.minutesToSunset)}`)
  nowLine.push(originIsReal ? walkingTime(km) : `~${walk} min from centre`)
  if (sunsetSpot && sun.sunset && sun.period !== 'night') {
    const arriveMin = Math.round((sun.sunset.getTime() - now.getTime()) / 60000) - walk
    if (arriveMin > 0) {
      const lb = leaveBy(sun, walk, city.timezone)
      if (lb) nowLine.push(`leave by ${lb}`)
      good = good || hours.status !== 'closed'
    } else if (sun.period !== 'golden') nowLine.push(`too far for tonight — sunset ${formatClock(sun.sunset, city.timezone)} tomorrow`)
  }
  const care = <TakeCare spot={spot} night={night} />
  return (
    <article className="spot" aria-labelledby="spot-name">
      {mobile && (
        <div className="spot-bar">
          <button type="button" className="word word--quiet" onClick={() => actions.backToList()}>← list</button>
          <button type="button" className="word" aria-pressed={saved} onClick={() => actions.toggleSaved(spot.id)}><span className="stone" aria-hidden="true" />{saved ? 'saved' : 'save'}</button>
        </div>
      )}
      <SpotImage spot={spot} cityName={city.name} />
      <h2 className="spot-name" id="spot-name" ref={nameRef} tabIndex={-1}>{spot.name}</h2>
      <p className="small">{[spot.neighborhood, spot.category, spot.indoor ? 'indoor' : 'outdoor', spot.free ? 'free' : 'paid'].filter(Boolean).join(' · ')}{spot.coordConfidence === 'low' ? ' · location approximate' : ''}</p>
      <p className={good ? 'moss' : 'ink2'} style={{ fontSize: 'var(--t-small)' }}>{nowLine.join(' · ')}{originIsReal ? '' : ''}</p>
      <p className="blurb">{spot.blurb}</p>
      {night && care}
      {spot.tips && <p className="pull">{spot.tips}</p>}
      <section className="section">
        <h3 className="h3">best at</h3>
        <p>{spot.bestTimes.map((t, i) => <span key={t}>{i > 0 && ' · '}<span className={t === currentTime ? 'hit' : ''} style={t === currentTime ? { textDecoration: 'underline', textDecorationColor: 'var(--accent)', textUnderlineOffset: '.25em' } : undefined}>{TIME_WORDS[t]}</span></span>)}</p>
      </section>
      <section className="section">
        <h3 className="h3">hours</h3>
        <p><span className="mono">{spot.hours}</span>{' · '}<span className={hours.status === 'open' ? 'moss' : 'ink2'}>{hours.confidence === 'high' ? (hours.status === 'open' ? 'open now' : 'closed now') : 'see hours'}</span></p>
      </section>
      {!night && care}
      {spot.sources.length > 0 && (
        <section className="section">
          <h3 className="h3">sources</h3>
          <ul className="sources">
            {spot.sources.map((src) => (
              <li key={src.url}><span className="kind">{src.kind}</span><a className="word word--small" href={src.url} target="_blank" rel="noreferrer">{src.label}</a></li>
            ))}
          </ul>
        </section>
      )}
      {originIsReal && <p className="small">{formatDistance(km, units)} from you</p>}
      <div className="words" style={{ gap: '10px 28px', paddingTop: 8 }}>
        <button type="button" className="word" aria-pressed={saved} onClick={() => actions.toggleSaved(spot.id)}><span className="stone" aria-hidden="true" />{saved ? 'saved' : 'save'}</button>
        <ShareWord title={`${spot.name} — TrueChiller`} />
        <button type="button" className="word" onClick={() => setBreathe(true)}>breathe here</button>
      </div>
      <BreatheOverlay name={spot.name} open={breathe} onClose={() => setBreathe(false)} still={still} />
    </article>
  )
}
