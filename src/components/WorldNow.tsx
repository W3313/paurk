import { useMemo, useState } from 'react'
import { cities } from '../data'
import type { Period } from '../lib/time'
import { WORLD_LABEL, WORLD_ORDER, worldNow, type WorldEntry } from '../lib/phase'
import { actions } from '../store'
import { getGlobe } from '../globe/handle'

interface Props { now: Date; onAll: () => void }

const PER_GROUP = 4

/**
 * Sky only: cities grouped by what is happening there right now, each carrying its own countdown to
 * whatever comes next there (sunset while the sun is still up, sunrise once it is down). The landing
 * page used to show one such countdown for one guessed city, which was only ever right for one place.
 */
export function WorldNow({ now, onAll }: Props) {
  const [open, setOpen] = useState<Period[]>([])
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
            {(open.includes(g.period) ? g.entries : g.entries.slice(0, PER_GROUP)).map(({ city, next }) => (
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
                {/* Opens this band where it stands. It used to hand the period up to be searched, and the
                    search ignored it: "4 more" produced an alphabetical list of all forty-four cities. */}
                <button type="button" className="word word--quiet" aria-expanded={open.includes(g.period)}
                  onClick={() => setOpen((o) => (o.includes(g.period) ? o.filter((x) => x !== g.period) : [...o, g.period]))}>
                  {open.includes(g.period) ? 'fewer' : `${g.entries.length - PER_GROUP} more`}
                </button>
              </li>
            )}
          </ul>
        </div>
      ))}
      <p className="worldnow-city"><button type="button" className="word word--quiet" onClick={() => { actions.setMode('sky'); onAll() }}>all {cities.length} cities</button></p>
    </div>
  )
}
