import type { Spot, Vibe } from '../types'
import { actions, useStore } from '../store'

interface Props { spots: Spot[]; suggested: string[] }

/** A row of vibe words with live match counts (spec §6.7). Filtering is AND. */
export function VibeRow({ spots, suggested }: Props) {
  const active = useStore((s) => s.vibes)
  const present: Vibe[] = []
  for (const s of spots) for (const v of s.vibes) if (!present.includes(v)) present.push(v)
  if (!present.length) return null
  const countFor = (v: Vibe) => spots.filter((s) => s.vibes.includes(v) && active.filter((a) => a !== v).every((a) => s.vibes.includes(a))).length
  return (
    <div className="vibes" role="group" aria-label="Vibes">
      {present.map((v) => {
        const on = active.includes(v)
        return (
          <button key={v} type="button" className={`word vibe${on ? ' is-on' : ''}${suggested.includes(v) && !on ? ' is-suggested' : ''}`} aria-pressed={on}
            onClick={() => { actions.toggleVibe(v); const next = on ? active.filter((a) => a !== v) : [...active, v]; const n = spots.filter((s) => next.every((a) => s.vibes.includes(a))).length; actions.note(next.length ? (n ? `${n} ${n === 1 ? 'place matches' : 'places match'} ${next.join(' + ')}` : `nothing matches ${next.join(' + ')} here right now — loosen a word`) : `${spots.length} places`) }}>
            {v}<span className="count" aria-label={`${countFor(v)} matching`}>{countFor(v)}</span>
          </button>
        )
      })}
      {active.length > 0 && <button type="button" className="word word--quiet word--small" onClick={() => actions.clearVibes()}>loosen all</button>}
    </div>
  )
}
