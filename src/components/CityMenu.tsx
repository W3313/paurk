import { useMemo } from 'react'
import { cities } from '../data'
import { worldNow, type WorldEntry } from '../lib/phase'
import { actions } from '../store'
import { getGlobe } from '../globe/handle'

interface Props { now: Date; current: string | null }

type Band = 'golden' | 'night' | 'day'
const BAND_LABEL: Record<Band, string> = { golden: 'golden hour', night: 'night', day: 'day' }
const ORDER: Band[] = ['golden', 'night', 'day']

/** Golden hour is its own thing; otherwise it is simply whether the sun is up there. */
function bandOf(e: WorldEntry): Band {
  if (e.sun.period === 'golden') return 'golden'
  return e.sun.period === 'night' || e.sun.period === 'dusk' ? 'night' : 'day'
}

/**
 * The sky's left column: every city at once, grouped by what the light is doing there and ordered by
 * what happens there soonest. It is the counterpart of the spot column on the city screen — one slides
 * out as the other slides in, and the globe crosses between them.
 */
export function CityMenu({ now, current }: Props) {
  const groups = useMemo(() => {
    const byBand = new Map<Band, WorldEntry[]>()
    for (const e of worldNow(cities, now).list) {
      const b = bandOf(e)
      byBand.set(b, [...(byBand.get(b) ?? []), e])
    }
    return ORDER.filter((b) => byBand.has(b)).map((b) => ({
      band: b,
      entries: byBand.get(b)!.sort((a, z) => (a.minutes ?? Infinity) - (z.minutes ?? Infinity)),
    }))
  }, [now])

  const open = (slug: string) => { const g = getGlobe(); if (g) g.select(slug); else actions.openCity(slug) }

  return (
    <nav className="citymenu" aria-label="All cities">
      <p className="small citymenu-head">{cities.length} cities</p>
      {groups.map((g) => (
        <div className="citymenu-group" key={g.band}>
          <p className="region-head">{BAND_LABEL[g.band]}</p>
          <ul className="citymenu-list" role="list">
            {g.entries.map(({ city, next }) => (
              <li className="citymenu-city" key={city.slug}>
                <a
                  className={`word${city.slug === current ? ' is-here' : ''}`}
                  href={`#/c/${city.slug}`}
                  aria-current={city.slug === current ? 'page' : undefined}
                  onClick={(e) => { e.preventDefault(); open(city.slug) }}
                  onPointerEnter={() => getGlobe()?.setHot(city.slug)}
                  onPointerLeave={() => getGlobe()?.setHot(null)}
                  onFocus={() => getGlobe()?.setHot(city.slug)}
                  onBlur={() => getGlobe()?.setHot(null)}
                >{city.name}</a>
                {next && <span className="citymenu-next mono">{next}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
