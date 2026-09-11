import { useMemo } from 'react'
import { cities } from '../data'
import { sunInfo, type Period } from '../lib/time'
import { WORLD_LABEL, WORLD_ORDER } from '../lib/phase'
import { actions } from '../store'
import { getGlobe } from '../globe/handle'
import type { City } from '../types'

interface Props { now: Date; onMore: (period: Period | null) => void }

/** Sky only: cities grouped by what is happening there right now, as tappable words (spec §6.3). */
export function WorldNow({ now, onMore }: Props) {
  const groups = useMemo(() => {
    const byPeriod = new Map<Period, City[]>()
    for (const c of cities) {
      const p = sunInfo(now, c).period
      byPeriod.set(p, [...(byPeriod.get(p) ?? []), c])
    }
    return WORLD_ORDER.filter((p) => byPeriod.has(p)).map((p) => ({ period: p, cities: byPeriod.get(p)!.sort((a, b) => a.lng - b.lng) }))
  }, [now])
  const shown = groups.slice(0, 3)
  return (
    <div className="worldnow" aria-label="Now in the world">
      {shown.map((g) => (
        <div className="worldnow-row" key={g.period}>
          <span className="worldnow-label">{WORLD_LABEL[g.period]}</span>
          <span className="worldnow-cities">
            {g.cities.slice(0, 4).map((c) => (
              <a key={c.slug} className="word" href={`#/c/${c.slug}`}
                onClick={(e) => { e.preventDefault(); getGlobe()?.select(c.slug) }}
                onPointerEnter={() => getGlobe()?.setHot(c.slug)} onPointerLeave={() => getGlobe()?.setHot(null)}
                onFocus={() => getGlobe()?.setHot(c.slug)} onBlur={() => getGlobe()?.setHot(null)}>{c.name}</a>
            ))}
            {g.cities.length > 4 && <button type="button" className="word word--quiet" onClick={() => onMore(g.period)}>+{g.cities.length - 4}</button>}
          </span>
        </div>
      ))}
      <div className="worldnow-row">
        <span className="worldnow-label" />
        <span className="worldnow-cities"><button type="button" className="word word--quiet" onClick={() => { actions.setMode('sky'); onMore(null) }}>all {cities.length}</button></span>
      </div>
    </div>
  )
}
