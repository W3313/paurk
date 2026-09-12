import { useMemo, useState } from 'react'
import { cities, spotsByCity } from '../data'
import type { City, LatLng } from '../types'
import type { SunInfo } from '../lib/time'
import { dailyPick } from '../lib/rank'
import { actions } from '../store'
import { PlateCaption } from './PlateCaption'
import { MarginNote } from './MarginNote'
import { WorldNow } from './WorldNow'
import { getGlobe } from '../globe/handle'

interface Props { now: Date; sun: SunInfo | null; place: City | null; userPos: LatLng | null; onSearch: () => void; onAbout: () => void }

export function PhaseLine({ text, className = '' }: { text: string; className?: string }) {
  const words = text.split(' ')
  return <p className={`phase ${className}`} aria-label={text}>{words.map((w, i) => <span key={`${i}-${w}`}><span className="w" style={{ '--i': i } as React.CSSProperties}>{w}</span>{i < words.length - 1 ? ' ' : ''}</span>)}</p>
}

/** The Sky's text stack under the globe (spec §3.2). */
export function SkyText({ now, sun, place, userPos, onSearch, onAbout }: Props) {
  const [seed, setSeed] = useState(0)
  const pick = useMemo(() => {
    if (!place) return null
    const list = (spotsByCity.get(place.slug) ?? []).filter((s) => s.lowkeyScore >= 4 && (sun?.period !== 'night' || s.safety.level === 'ok'))
    return dailyPick(list.length ? list : spotsByCity.get(place.slug) ?? [], now, seed)
  }, [place, now, seed, sun])
  return (
    <div className="sky-text">
      <PlateCaption parts={[`${cities.length} cities`]} bare />
      <MarginNote fallback={userPos ? 'tap a city, or the list below' : 'drag the globe, or search'} />
      <WorldNow now={now} onMore={() => onSearch()} />
      {place && pick && (
        <p className="serendipity">today in {place.name}: <a className="word word--small" href={`#/s/${pick.id}`} onClick={(e) => { e.preventDefault(); getGlobe()?.select(place.slug, false); actions.openSpot(pick.id) }}>{pick.name}</a> · <button type="button" className="word word--quiet word--small" onClick={() => setSeed((s) => s + 1)}>another</button></p>
      )}
      <p className="only-mobile"><button type="button" className="word word--quiet word--small" onClick={onAbout}>about</button></p>
    </div>
  )
}
