import { useMemo, useState } from 'react'
import { cities, spotsByCity } from '../data'
import type { City, LatLng } from '../types'
import { formatClock, formatCountdown, type SunInfo } from '../lib/time'
import { phaseLine } from '../lib/phase'
import { dailyPick } from '../lib/rank'
import { actions, useStore } from '../store'
import { PlateCaption } from './PlateCaption'
import { MarginNote } from './MarginNote'
import { AroundYou } from './AroundYou'
import { WorldNow } from './WorldNow'
import { getGlobe } from '../globe/handle'

interface Props { now: Date; sun: SunInfo | null; place: City | null; userPos: LatLng | null; timeZone: string; onChooseCity: () => void; onAbout: () => void }

export function PhaseLine({ text, className = '' }: { text: string; className?: string }) {
  const words = text.split(' ')
  return <p className={`phase ${className}`} aria-label={text}>{words.map((w, i) => <span key={`${i}-${w}`}><span className="w" style={{ '--i': i } as React.CSSProperties}>{w}</span>{i < words.length - 1 ? ' ' : ''}</span>)}</p>
}

/** The Sky's text stack under the globe (spec §3.2). */
export function SkyText({ now, sun, place, userPos, timeZone, onChooseCity, onAbout }: Props) {
  const online = useStore((s) => s.online)
  const weather = useStore((s) => s.weather)
  const [seed, setSeed] = useState(0)
  const pick = useMemo(() => {
    if (!place) return null
    const list = (spotsByCity.get(place.slug) ?? []).filter((s) => s.lowkeyScore >= 4 && (sun?.period !== 'night' || s.safety.level === 'ok'))
    return dailyPick(list.length ? list : spotsByCity.get(place.slug) ?? [], now, seed)
  }, [place, now, seed, sun])
  const goldenSoon = sun && sun.minutesToGolden !== null && sun.minutesToGolden > 0 && sun.minutesToGolden <= 90
  return (
    <div className="sky-text">
      <PlateCaption parts={['the world', `${cities.length} cities`, place ? `${formatClock(now, timeZone)} in ${place.name}` : formatClock(now, timeZone)]} />
      {goldenSoon && sun && <p className="golden-num display-num" aria-label={`golden hour in ${formatCountdown(sun.minutesToGolden!)}`}>{formatCountdown(sun.minutesToGolden!)}</p>}
      {sun && <PhaseLine text={phaseLine(now, sun, timeZone, { offline: !online, weather })} />}
      <MarginNote fallback={userPos ? 'tap a city, or the list below' : 'drag the globe, or choose a city'} />
      <AroundYou onChooseCity={onChooseCity} />
      <WorldNow now={now} onMore={() => onChooseCity()} />
      {place && pick && (
        <p className="serendipity">today in {place.name}: <a className="word word--small" href={`#/s/${pick.id}`} onClick={(e) => { e.preventDefault(); getGlobe()?.select(place.slug, false); actions.openSpot(pick.id) }}>{pick.name}</a> · <button type="button" className="word word--quiet word--small" onClick={() => setSeed((s) => s + 1)}>another</button></p>
      )}
      <p className="only-mobile"><button type="button" className="word word--quiet word--small" onClick={onAbout}>about</button></p>
    </div>
  )
}
