import { useMemo } from 'react'
import { cities } from '../data'
import type { Period } from '../lib/time'
import { WORLD_LABEL, WORLD_ORDER, worldNow, type WorldEntry } from '../lib/phase'
import { actions } from '../store'
import { getGlobe } from '../globe/handle'

interface Props { now: Date; onMore: (period: Period | null) => void }

const PER_GROUP = 4

/**
 * Sky only: cities grouped by what is happening there right now, each carrying its own countdown to
 * whatever comes next there (sunset while the sun is still up, sunrise once it is down). The landing
 * page used to show one such countdown for one guessed city, which was only ever right for one place.
 */
export function WorldNow({ now, onMore }: Props) {
  const groups = useMemo(() => {
    const byPeriod = new Map<Period, WorldEntry[]>()
    for (const e of worldNow(cities, now).list) {
      byPeriod.set(e.sun.period, [...(byPeriod.get(e.sun.period) ?? []), e])
    }
    return WORLD_ORDER.filter((p) => byPeriod.has(p)).map((p) => ({
      period: p,
      // Soonest first, so the city about to lose its light leads the group and the countdowns read down.
      entries: byPeriod.get(p)!.sort((a, b) => (a.minutes ?? Infinity) - (b.minutes ?? Infinity)),
    }))
  }, [now])

  return (
    <div className="worldnow" aria-label="Now in the world">
      {groups.slice(0, 3).map((g) => (
        <div className="worldnow-group" key={g.period}>
          <p className="worldnow-label">{WORLD_LABEL[g.period]}</p>
          <ul className="worldnow-list">
            {g.entries.slice(0, PER_GROUP).map(({ city, next }) => (
              <li className="worldnow-city" key={city.slug}>
                <a className="word" href={`#/c/${city.slug}`}
                  onClick={(e) => { e.preventDefault(); const globe = getGlobe(); if (globe) globe.select(city.slug); else actions.openCity(city.slug) }}
                  onPointerEnter={() => getGlobe()?.setHot(city.slug)} onPointerLeave={() => getGlobe()?.setHot(null)}
                  onFocus={() => getGlobe()?.setHot(city.slug)} onBlur={() => getGlobe()?.setHot(null)}>{city.name}</a>
                {next && <span className="worldnow-next mono">{next}</span>}
              </li>
            ))}
            {g.entries.length > PER_GROUP && (
              <li className="worldnow-city">
                <button type="button" className="word word--quiet" onClick={() => onMore(g.period)}>{g.entries.length - PER_GROUP} more</button>
              </li>
            )}
          </ul>
        </div>
      ))}
      <p className="worldnow-city"><button type="button" className="word word--quiet" onClick={() => { actions.setMode('sky'); onMore(null) }}>all {cities.length} cities</button></p>
    </div>
  )
}
