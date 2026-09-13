import { useEffect, useMemo, useState } from 'react'
import type { City, LatLng } from '../types'
import { loadDetails, spotsByCity } from '../data'
import { actions, useStore } from '../store'
import type { SunInfo } from '../lib/time'
import { pickVerb } from '../lib/pointer'
import { formatClock, localMinutes } from '../lib/time'
import { phaseLine, SUGGESTED } from '../lib/phase'
import { rankSpots } from '../lib/rank'
import { distanceKm, formatDistance, compassLabel, bearingDeg } from '../lib/geo'
import { PlateCaption } from './PlateCaption'
import { MarginNote } from './MarginNote'
import { SunRule } from './SunRule'
import { VibeRow } from './VibeRow'
import { SpotList, useRankContext } from './SpotList'
import { SpotPage } from './SpotPage'
import { Loupe } from './Loupe'
import { PhaseLine } from './SkyText'
import { useHeading } from '../hooks/useHeading'

interface Props { city: City; now: Date; live: Date; sun: SunInfo; preview: boolean; origin: LatLng | null; originIsReal: boolean; mobile: boolean; spotId: string | null }

const DIRS: Record<string, string> = { N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west' }

/** The right column (desktop) / sheet content (mobile) for a city, or the spot page inside it (spec §3.2). */
export function CityColumn({ city, now, live, sun, preview, origin, originIsReal, mobile, spotId }: Props) {
  const spots = useMemo(() => spotsByCity.get(city.slug) ?? [], [city.slug])
  const online = useStore((s) => s.online)
  const weather = useStore((s) => s.weather)
  const previewMinutes = useStore((s) => s.previewMinutes)
  const pinned = useStore((s) => s.pinnedMinutes)
  const units = useStore((s) => s.units)
  const accuracy = useStore((s) => s.userAccuracyM)
  const [hot, setHot] = useState<string | null>(null)
  const heading = useHeading()
  // Opening a city is a strong signal a spot page is next, so warm the prose chunk now.
  useEffect(() => { void loadDetails() }, [])
  const ctx = useRankContext(city, now, sun, origin)
  const ranked = useMemo(() => rankSpots(spots, ctx), [spots, ctx])
  const good = ranked.filter((r) => r.reasons.length > 0 && r.hours?.status !== 'closed').length
  const spot = spotId ? spots.find((s) => s.id === spotId) ?? null : null
  const unreviewed = spots.filter((s) => !s.verified).length

  const far = originIsReal && origin ? distanceKm(origin, city) : 0
  const compass = originIsReal && origin ? `you are ${formatDistance(far, units)} ${DIRS[compassLabel(bearingDeg(city, origin))]} of the centre` : null

  if (spot) {
    return (
      <div className="column-head" style={{ gap: 'var(--s-5)' }}>
        {!mobile && <p><button type="button" className="word word--quiet" onClick={() => actions.backToList()}>← {city.name}</button></p>}
        <SpotPage spot={spot} city={city} now={now} sun={sun} origin={origin} originIsReal={originIsReal} />
      </div>
    )
  }
  return (
    <>
      <div className="column-head">
        {!mobile && <p><button type="button" className="word word--quiet" onClick={() => actions.sky()}>← sky</button></p>}
        {/* On a phone the sheet's sticky bar is already carrying the city name a few pixels above this,
            so printing it twice cost about 90px of the run-up to the first row. The bar is the heading
            there; the country line stays, since the bar does not say it. */}
        {!mobile && <h2 className={`city-name${!mobile ? ' is-writing' : ''}`}>{originIsReal && far <= 80 ? <span className="small" style={{ display: 'block' }}>around you</span> : null}{city.name}</h2>}
        {mobile && originIsReal && far <= 80 && <p className="small">around you</p>}
        <p className="small">{city.country}</p>
        {/* On phones these used to sit between the globe and the sheet; the list is the whole screen now,
            so they come with it — the phase line is the app's premise and cannot be the thing that is
            left behind the paper. */}
        <PlateCaption parts={[city.name.toLowerCase(), `${spots.length} places`, formatClock(now, city.timezone)]} />
        <PhaseLine text={phaseLine(now, sun, city.timezone, { preview, offline: !online, weather })} />
        {preview && <p className="small">showing {formatClock(now, city.timezone)} · <button type="button" className="word word--small" onClick={() => actions.setPreview(null)}>back to now</button></p>}
      </div>
      <SunRule cityName={city.name} timeZone={city.timezone} lat={city.lat} lng={city.lng} now={live}
        previewMinutes={previewMinutes} onPreview={(m) => actions.setPreview(m)} onPin={(m) => { actions.pin(m); actions.note(`pinned to ${formatClock(now, city.timezone)}`) }} pinned={pinned !== null && pinned === previewMinutes} />
      {compass && (
        <p className="compass-row">{compass}{accuracy && accuracy > 2000 ? ' · approximate' : ''}
          {heading.supported && !heading.active && <> · <button type="button" className="word word--small" onClick={() => void heading.start()}>point the needles</button></>}
          {heading.supported && heading.active && ' · needles follow you'}
          {!heading.active && ' · N is up'}
        </p>
      )}
      {originIsReal && origin && far <= 80 && <Loupe origin={origin} spots={spots} hotId={hot} />}
      <VibeRow spots={spots} suggested={SUGGESTED[sun.period]} />
      <MarginNote fallback={`${spots.length} places · ${good} good right now · ${pickVerb()} a row to open it${unreviewed ? ` · ${unreviewed} not yet reviewed` : ''}`} />
      <SpotList city={city} spots={spots} now={now} sun={sun} origin={origin} originIsReal={originIsReal} onHot={setHot} />
      {/* Only while the rule is being dragged. It used to render as an empty paragraph the rest of the
          time, which is invisible but still a child of a flex column and so still took its 20px gap. */}
      {previewMinutes !== null && (
        <p className="small">{`sun-rule at ${String(Math.floor(previewMinutes / 60)).padStart(2, '0')}:${String(previewMinutes % 60).padStart(2, '0')} · now is ${String(Math.floor(localMinutes(live, city.timezone) / 60)).padStart(2, '0')}:${String(localMinutes(live, city.timezone) % 60).padStart(2, '0')}`}</p>
      )}
    </>
  )
}
