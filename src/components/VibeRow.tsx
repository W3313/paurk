import { useId, useState } from 'react'
import type { Spot, Vibe } from '../types'
import { actions, useStore } from '../store'

interface Props { spots: Spot[]; suggested: string[] }

/**
 * Vibe filtering (spec §6.7), folded behind one word. Nineteen chips laid out flat crowded the head
 * of the column and buried the list; they open on request instead. Filtering is AND, and what is
 * currently on is printed on the trigger so it is never hidden behind a closed panel.
 */
export function VibeRow({ spots, suggested }: Props) {
  const active = useStore((s) => s.vibes)
  const [open, setOpen] = useState(false)
  const id = useId()
  const present: Vibe[] = []
  for (const s of spots) for (const v of s.vibes) if (!present.includes(v)) present.push(v)
  if (!present.length) return null
  const countFor = (v: Vibe) =>
    spots.filter((s) => s.vibes.includes(v) && active.filter((a) => a !== v).every((a) => s.vibes.includes(a))).length

  const toggle = (v: Vibe, on: boolean) => {
    actions.toggleVibe(v)
    const next = on ? active.filter((a) => a !== v) : [...active, v]
    const n = spots.filter((s) => next.every((a) => s.vibes.includes(a))).length
    actions.note(next.length
      ? (n ? `${n} ${n === 1 ? 'place matches' : 'places match'} ${next.join(' + ')}` : `nothing matches ${next.join(' + ')} here right now — loosen a word`)
      : `${spots.length} places`)
  }

  return (
    // Escape closes the panel and stops there: without this it also reaches the app's own handler,
    // which reads Escape on a city screen as "go back to the sky".
    <div className="vibes-wrap" onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false) } }}>
      <div className="words vibes-head">
        <button type="button" className={`word vibes-trigger${open ? ' is-open' : ''}`} aria-expanded={open} aria-controls={id}
          onClick={() => setOpen((o) => !o)}>
          vibes<span className="vibes-caret" aria-hidden="true" />
        </button>
        {/* What is on is printed rather than counted: the words say more than a number, and they are the
            only thing standing between the reader and a list that has quietly been filtered. */}
        {active.length > 0 && <span className="small vibes-on">{active.join(' + ')}</span>}
        {active.length > 0 && <button type="button" className="word word--quiet word--small" onClick={() => actions.clearVibes()}>loosen all</button>}
      </div>
      <div className={`vibes-panel${open ? ' is-open' : ''}`}>
        <div className="vibes-clip">
          <div className="vibes" id={id} role="group" aria-label="Vibes" {...(open ? {} : { inert: true })}>
            {present.map((v) => {
              const on = active.includes(v)
              return (
                <button key={v} type="button" aria-pressed={on}
                  className={`word vibe${on ? ' is-on' : ''}${suggested.includes(v) && !on ? ' is-suggested' : ''}`}
                  onClick={() => toggle(v, on)}>
                  {v}<span className="count" aria-label={`${countFor(v)} matching`}>{countFor(v)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
