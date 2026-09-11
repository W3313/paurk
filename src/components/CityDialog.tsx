import { useEffect, useMemo, useRef, useState } from 'react'
import { cities } from '../data'
import { formatClock, PERIOD_LABEL, sunInfo, tzOffsetMinutes } from '../lib/time'
import { guessCity } from '../lib/phase'
import type { City } from '../types'

interface Props { open: boolean; onClose: () => void; onPick: (slug: string) => void; current: string | null; now: Date }

const REGION_LABEL: Record<string, string> = { americas: 'the americas', 'europe-africa': 'europe and africa', 'asia-pacific': 'asia and the pacific', other: 'elsewhere' }
const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')

/** Native dialog: type a city, or pick from the regions (spec §6.4). The no-WebGL and no-location path. */
export function CityDialog({ open, onClose, onPick, current, now }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [q, setQ] = useState('')
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) { setQ(''); d.showModal() }
    if (!open && d.open) d.close()
  }, [open])
  const guess = useMemo(() => guessCity(cities, now), [now])
  const here = -now.getTimezoneOffset()
  let tz = ''
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone } catch { /* ignore */ }
  const list = useMemo(() => {
    const f = fold(q.trim())
    const matches = cities.filter((c) => !f || fold(c.name).includes(f) || fold(c.country).includes(f))
    const rank = (c: City) => (c.timezone === tz ? 0 : tzOffsetMinutes(now, c.timezone) === here ? 1 : 2)
    const regions = new Map<string, City[]>()
    for (const c of matches.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))) regions.set(c.region, [...(regions.get(c.region) ?? []), c])
    return [...regions.entries()]
  }, [q, now, tz, here])
  return (
    <dialog ref={ref} onClose={onClose} aria-label="Choose a city" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="dialog">
        <button type="button" className="word word--quiet dialog-close" onClick={onClose}>close</button>
        <input className="search" type="search" placeholder="type a city" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Type a city" />
        {!q && guess && (
          <p className="small">guess: {guess.name} (from your clock) · <button type="button" className="word word--small" onClick={() => onPick(guess.slug)}>open {guess.name}</button></p>
        )}
        {list.length === 0 && <p className="empty">No city called “{q}” — try the region list below.</p>}
        {list.length === 0 && <button type="button" className="word word--quiet" onClick={() => setQ('')}>show all</button>}
        {list.map(([region, cs]) => (
          <div key={region}>
            <p className="region-head">{REGION_LABEL[region] ?? region}</p>
            <ul>
              {cs.map((c) => {
                const s = sunInfo(now, c)
                return (
                  <li className="city-row" key={c.slug}>
                    <span>{c.slug === current && <><span className="current-dot" aria-hidden="true" /><span className="vh">current: </span></>}<button type="button" className="word" onClick={() => onPick(c.slug)}>{c.name}</button></span>
                    <span className="mono">{formatClock(now, c.timezone)} · {PERIOD_LABEL[s.period]}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </dialog>
  )
}
