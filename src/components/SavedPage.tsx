import { useMemo } from 'react'
import { cityBySlug, spotById } from '../data'
import { actions, useStore } from '../store'
import { useNow } from '../hooks/useNow'
import { sunInfo } from '../lib/time'
import { rankSpots, type Context, vibeCounts } from '../lib/rank'
import { distanceKm } from '../lib/geo'
import { parseHours } from '../lib/hours'
import { SpotRow } from './SpotRow'

/** Saved spots grouped by city, headed by a row of dots, one per save (spec §6.14). */
export function SavedPage() {
  const ids = useStore((s) => s.savedIds)
  const origin = useStore((s) => s.userPos)
  const accuracy = useStore((s) => s.userAccuracyM)
  const now = useNow()
  const groups = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const id of ids) { const c = id.split('/')[0]; m.set(c, [...(m.get(c) ?? []), id]) }
    return [...m.entries()]
  }, [ids])
  if (!ids.length) return <p className="empty">Nothing saved yet. Save a spot and it will wait here.</p>
  return (
    <div className="column-head" style={{ gap: 'var(--s-4)' }}>
      <p aria-hidden="true" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {ids.slice(0, 40).map((id) => <span key={id} style={{ width: 10, height: 7, borderRadius: '50%', background: 'var(--ink)', display: 'inline-block' }} />)}
        {ids.length > 40 && <span className="mono">+{ids.length - 40}</span>}
      </p>
      <p className="small">{ids.length} saved in {groups.length} {groups.length === 1 ? 'city' : 'cities'}</p>
      {groups.map(([slug, sids]) => {
        const city = cityBySlug.get(slug)
        if (!city) return null
        const sun = sunInfo(now, city)
        // Distances are only real when you are actually near that city, as on the city screen.
        const near = !!origin && distanceKm(origin, city) <= 80 && (accuracy === null || accuracy < 50000)
        const from = near ? origin : null
        const ctx: Context = { period: sun.period, raining: false, vibes: [], origin: from, hours: (s) => parseHours(s.hours, now, city.timezone, { sunrise: sun.sunrise, sunset: sun.sunset }) }
        const ranked = rankSpots(sids.map((id) => spotById.get(id)!).filter(Boolean), ctx)
        const common = vibeCounts(ranked)
        return (
          <section key={slug} className="section">
            <h2 className="display" style={{ fontSize: 'var(--t-display-m)' }}><a className="word word--display" href={`#/c/${slug}`} onClick={(e) => { e.preventDefault(); actions.openCity(slug) }}>{city.name}</a></h2>
            <ul className="rows" role="list">
              {ranked.map((r, i) => <SpotRow key={r.spot.id} ranked={r} city={city} now={now} sun={sun} ctx={ctx} origin={from} originIsReal={near} index={i} common={common} />)}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
