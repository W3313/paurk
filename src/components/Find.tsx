import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cities, cityBySlug, spotById, spots, spotsByCity } from '../data'
import { actions, useStore } from '../store'
import { formatClock, PERIOD_LABEL, sunInfo, tzOffsetMinutes, type SunInfo } from '../lib/time'
import { guessCity, worldNow } from '../lib/phase'
import { rankSpots, type Context } from '../lib/rank'
import { parseHours } from '../lib/hours'
import { distanceKm, formatDistance } from '../lib/geo'
import { fold, search, type Via } from '../lib/search'
import { geoAvailable, geoDenied, locateOnce, nearestCity } from '../lib/locate'
import { getGlobe } from '../globe/handle'
import type { City, LatLng, Spot } from '../types'

interface Props { open: boolean; onClose: () => void; now: Date }

interface Row {
  key: string
  name: string
  sub?: ReactNode
  when?: string
  tail?: ReactNode
  wrap?: boolean
  disabled?: boolean
  current?: boolean
  /** Which city lights up on the globe while this row is active. */
  citySlug: string | null
  ariaLabel: string
  activate: () => void
}
interface Group { id: string; heading: string | null; rows: Row[] }

const REGION_LABEL: Record<string, string> = {
  americas: 'the americas', 'europe-africa': 'europe and africa', 'asia-pacific': 'asia and the pacific', other: 'elsewhere',
}
const CONSENT = 'We look at your location once, on this device. Nothing leaves it.'
/** Result rows shown at once, before the standing `all N cities` row. */
const MAX_ROWS = 8
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The word that actually matched, when it was not the name: a category, or one of the spot's vibes. */
function matchWord(via: Via, spot: Spot, q: string): string | null {
  if (via === 'kind') return spot.category
  if (via === 'vibe') { const f = fold(q.trim()); return spot.vibes.find((v) => fold(v) === f) ?? null }
  return null
}

/** `18:42 · golden hour` — the same two facts on every row, so a result says when it is there. */
const whenOf = (now: Date, city: City, sun: SunInfo) => `${formatClock(now, city.timezone)} · ${PERIOD_LABEL[sun.period]}`

/**
 * The one way in besides the globe: a combobox over every city and every place, with a standing list
 * that is already useful before a letter is typed. It replaces the old modal city picker, so it also
 * carries the no-WebGL path — all 44 cities are reachable here without typing and without a globe.
 */
export function Find({ open, onClose, now }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [q, setQ] = useState('')
  const [body, setBody] = useState<'standing' | 'browse'>('standing')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [nearestFirst, setNearestFirst] = useState<LatLng | null>(null)
  const [status, setStatus] = useState('')

  const citySlug = useStore((s) => s.citySlug)
  const userPos = useStore((s) => s.userPos)
  const geoStatus = useStore((s) => s.geoStatus)
  const savedIds = useStore((s) => s.savedIds)
  const visited = useStore((s) => s.visitedCities)
  const units = useStore((s) => s.units)
  const weather = useStore((s) => s.weather)

  const world = useMemo(() => worldNow(cities, now), [now])
  const sunOf = useCallback((c: City) => world.byCity.get(c.slug)?.sun ?? sunInfo(now, c), [world, now])

  const close = useCallback(() => { ref.current?.close() }, [])

  // ---- around me ---------------------------------------------------------------------------------

  const runLocate = useCallback(() => {
    setNote(null)
    locateOnce().then(
      ({ city, km, near }) => {
        if (near) { close(); return }
        const line = `The nearest city we know is ${city.name}, ${formatDistance(km, units)} away.`
        setNote(line); setStatus(line)
        setBody('browse')
      },
      () => { setNote('no location — that is fine'); setStatus('no location'); setBody('browse') },
    )
  }, [units, close])
  // The globe flight inside locateOnce resolves after the position lands, so re-sort once we have it.
  useEffect(() => { if (userPos && note) setNearestFirst(userPos) }, [userPos, note])

  // ---- rows -------------------------------------------------------------------------------------

  const cityRow = useCallback((city: City, opts: { sub?: ReactNode; subText?: string; tail?: boolean } = {}): Row => {
    const e = world.byCity.get(city.slug)
    const sun = e?.sun ?? sunInfo(now, city)
    const when = whenOf(now, city, sun)
    const next = opts.tail === false ? null : e?.next ?? null
    const current = city.slug === citySlug
    return {
      key: `c:${city.slug}`,
      name: city.name,
      sub: opts.sub ?? (opts.sub === null ? null : `${city.country} · ${city.spotCount} places`),
      when,
      tail: next,
      current,
      citySlug: city.slug,
      ariaLabel: `${current ? 'Current: ' : ''}${city.name}, ${opts.subText ?? city.country}. ${when}.${next ? ` ${cap(next)}.` : ''}`,
      activate: () => { close(); const g = getGlobe(); if (g) g.select(city.slug); else actions.openCity(city.slug) },
    }
  }, [world, now, citySlug])

  const spotRow = useCallback((spot: Spot, extra?: string | null): Row => {
    const city = cityBySlug.get(spot.city)!
    const sun = sunOf(city)
    const when = whenOf(now, city, sun)
    const dark = sun.period === 'night' || sun.period === 'dusk'
    const caution = spot.safety.level === 'caution'
    // Safety is never hidden by a filter, and a search is a filter (spec §6.11).
    const tail = caution ? <span className="caution-word">{dark ? 'caution after dark' : 'caution'}</span> : null
    return {
      key: `s:${spot.id}`,
      name: spot.name,
      sub: (
        <>
          <span className="find-sub-main">{city.name}{spot.neighborhood ? ` · ${spot.neighborhood}` : ''}</span>
          {extra && <span className="find-sub-hit">· <span className="hit">{extra}</span></span>}
        </>
      ),
      when,
      tail,
      citySlug: spot.city,
      ariaLabel: `${spot.name}, ${city.name}. ${when}.${caution ? ` Caution${dark ? ' after dark' : ''}.` : ''}`,
      activate: () => { close(); getGlobe()?.select(spot.city, false); actions.openSpot(spot.id) },
    }
  }, [sunOf, now])

  const allRow = useCallback((): Row => ({
    key: 'all',
    name: `all ${cities.length} cities`,
    citySlug: null,
    ariaLabel: `All ${cities.length} cities.`,
    activate: () => { setBody('browse'); setQ('') },
  }), [])

  // ---- the standing list ------------------------------------------------------------------------

  const homeCity = useMemo(() => (userPos ? nearestCity(userPos).city : null) ?? guessCity(cities, now), [userPos, now])
  const homeFromPos = !!userPos

  const standing = useMemo((): Group[] => {
    const groups: Group[] = []
    const seen = new Set<string>()
    const keep = (rows: Row[]) => rows.filter((r) => (seen.has(r.key) ? false : (seen.add(r.key), true)))

    // 1. What the light is doing. Cities when it is dark where you are, places when it is not.
    const homeSun = homeCity ? sunOf(homeCity) : null
    const byLight = (): Row[] => {
      const want = (p: SunInfo['period'][]) => world.list
        .filter((e) => p.includes(e.sun.period) && e.city.slug !== homeCity?.slug && e.city.slug !== citySlug)
        .sort((a, b) => (a.minutes ?? Infinity) - (b.minutes ?? Infinity))
      const picked = [...want(['golden', 'morning']), ...want(['dawn']), ...want(['afternoon'])]
      return picked.slice(0, 3).map((e) => cityRow(e.city))
    }
    if (!homeCity || !homeSun) {
      groups.push({ id: 'light', heading: 'where the light is now', rows: keep(byLight()) })
    } else if (homeSun.period === 'night') {
      groups.push({ id: 'light', heading: 'awake somewhere else', rows: keep(byLight()) })
    } else {
      const ctx: Context = {
        period: homeSun.period, raining: !!weather?.isRaining, snowing: !!weather?.isSnowing,
        cold: !!weather && weather.tempC < 5, vibes: [], origin: null,
        hours: (s) => parseHours(s.hours, now, homeCity.timezone, { sunrise: homeSun.sunrise, sunset: homeSun.sunset }),
      }
      const top = rankSpots(spotsByCity.get(homeCity.slug) ?? [], ctx).slice(0, 3)
      groups.push({
        id: 'light',
        heading: homeSun.period === 'dusk' ? 'after dark' : 'good right now',
        rows: keep(top.map((r) => spotRow(r.spot))),
      })
    }

    // 2. Where you have been.
    const lately: Row[] = []
    for (const slug of [...visited].reverse()) {
      const c = cityBySlug.get(slug)
      if (c && c.slug !== citySlug) lately.push(cityRow(c))
      if (lately.length >= 3) break
    }
    for (const id of [...savedIds].reverse()) {
      if (lately.length >= 3) break
      const s = spotById.get(id)
      if (s) lately.push(spotRow(s))
    }
    const latelyRows = keep(lately)
    if (latelyRows.length) groups.push({ id: 'lately', heading: 'lately', rows: latelyRows })

    // 3. Two loose options, deliberately without a heading: the app cannot honestly write one here.
    const loose: Row[] = []
    if (homeCity && homeCity.slug !== citySlug) {
      const provenance = homeFromPos ? 'nearest to you' : 'from your clock'
      loose.push(cityRow(homeCity, { sub: provenance, subText: provenance }))
    }
    if (geoAvailable() && geoStatus !== 'granted') {
      const asking = geoStatus === 'asking'
      loose.push({
        key: 'around',
        name: asking ? 'looking once…' : geoDenied() ? 'try again' : 'around me',
        sub: asking ? 'looking once…' : CONSENT,
        wrap: true,
        disabled: asking,
        citySlug: null,
        ariaLabel: `Around me. ${CONSENT}`,
        activate: runLocate,
      })
    }
    if (loose.length) groups.push({ id: 'loose', heading: null, rows: keep(loose) })

    groups.push({ id: 'all', heading: null, rows: keep([allRow()]) })
    return groups.filter((g) => g.rows.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, now, homeCity, homeFromPos, citySlug, visited, savedIds, geoStatus, weather, cityRow, spotRow, allRow, sunOf, runLocate])

  // ---- browse: every city, grouped ---------------------------------------------------------------

  const browse = useMemo((): Group[] => {
    if (nearestFirst) {
      const rows = [...cities]
        .map((c) => ({ c, km: distanceKm(nearestFirst, c) }))
        .sort((a, b) => a.km - b.km)
        .map(({ c, km }) => cityRow(c, { sub: formatDistance(km, units), subText: formatDistance(km, units) }))
      return [{ id: 'near', heading: 'nearest to you', rows }]
    }
    let tz = ''
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone } catch { /* ignore */ }
    const here = -now.getTimezoneOffset()
    const rank = (c: City) => (c.timezone === tz ? 0 : tzOffsetMinutes(now, c.timezone) === here ? 1 : 2)
    const byRegion = new Map<string, City[]>()
    for (const c of [...cities].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))) {
      byRegion.set(c.region, [...(byRegion.get(c.region) ?? []), c])
    }
    return [...byRegion.entries()].map(([region, cs]) => ({
      id: `r:${region}`,
      heading: REGION_LABEL[region] ?? region,
      // The region heading already said the country, so the sub would only repeat it.
      rows: cs.map((c) => cityRow(c, { sub: null })),
    }))
  }, [nearestFirst, units, now, cityRow])

  // ---- results -----------------------------------------------------------------------------------

  const results = useMemo((): Group[] => {
    // Ask for the whole ranked list, not a capped head of it, and take the split from there. A cap
    // here would starve one kind whenever the other happens to outscore it: "o" fills its first fifty
    // hits with places whose second word starts in O, and every city named Toronto falls off the end.
    // Scoring 44 cities and 604 places takes well under a millisecond, so there is nothing to save.
    const hits = search(q, cities.length + spots.length, citySlug)
    const cs = hits.filter((h) => h.kind === 'city')
    const ss = hits.filter((h) => h.kind === 'spot')
    const nCities = Math.min(cs.length, ss.length ? 4 : MAX_ROWS)
    const nSpots = Math.min(ss.length, MAX_ROWS - nCities)
    const groups: Group[] = []
    if (nCities) {
      const rows = cs.slice(0, nCities).flatMap((h) => (h.kind === 'city' ? [cityRow(h.city)] : []))
      groups.push({ id: 'g:cities', heading: 'cities', rows })
    }
    if (nSpots) {
      // Say which word matched when it was not the name, so a hit on a category or a vibe explains itself.
      const rows = ss.slice(0, nSpots).flatMap((h) => (h.kind === 'spot'
        ? [spotRow(h.spot, matchWord(h.via, h.spot, q))]
        : []))
      groups.push({ id: 'g:places', heading: 'places', rows })
    }
    groups.push({ id: 'all', heading: null, rows: [allRow()] })
    return groups
  }, [q, citySlug, cityRow, spotRow, allRow])

  const typed = q.trim().length > 0
  const groups = typed ? results : body === 'browse' ? browse : standing
  const rows = useMemo(() => groups.flatMap((g) => g.rows), [groups])
  const nothing = typed && rows.length === 1

  // ---- active option -----------------------------------------------------------------------------

  // Sticky across the minute tick: only a row that has actually disappeared loses the highlight,
  // so an idle finger on Enter never quietly changes what it is about to open.
  useEffect(() => {
    setActiveKey((k) => (k && rows.some((r) => r.key === k) ? k : rows[0]?.key ?? null))
  }, [rows])
  // A new query always re-aims at the top hit: "tok" then Enter opens Tokyo.
  useEffect(() => { setActiveKey(rows[0]?.key ?? null) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q, body])

  const activeIndex = rows.findIndex((r) => r.key === activeKey)
  const active = activeIndex >= 0 ? rows[activeIndex] : null

  const activeCity = active?.citySlug ?? null
  useEffect(() => { if (open) getGlobe()?.setHot(activeCity) }, [open, activeCity])

  useEffect(() => {
    if (!activeKey || !listRef.current) return
    listRef.current.querySelector(`#find-opt-${CSS.escape(activeKey)}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeKey])

  const move = useCallback((delta: number) => {
    if (!rows.length) return
    const from = activeIndex < 0 ? 0 : activeIndex
    const to = Math.abs(delta) === 1
      ? (from + delta + rows.length) % rows.length
      : Math.min(rows.length - 1, Math.max(0, from + delta))
    setActiveKey(rows[to].key)
  }, [rows, activeIndex])

  // ---- open / close ------------------------------------------------------------------------------

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      setQ(''); setBody('standing'); setNote(null); setNearestFirst(null); setStatus('')
      d.showModal()
      // A soft keyboard on open would bury the standing list, which is the point of having one.
      const fine = matchMedia('(hover: hover) and (pointer: fine)').matches
      if (fine) inputRef.current?.focus()
      else d.focus()
    }
    if (!open && d.open) d.close()
  }, [open])

  useEffect(() => { actions.setFindOpen(open) }, [open])

  const handleClose = () => {
    getGlobe()?.setHot(null)
    actions.setFindOpen(false)
    onClose()
    // Native focus return lands on whatever was focused before the panel opened, which is nothing at
    // all when `/` opened it. The browser's restoration is asynchronous and does not race reliably
    // against one frame, so try twice; the second call no-ops once focus has landed somewhere real.
    const restore = () => {
      const el = document.activeElement
      if (!el || el === document.body || el === document.documentElement) {
        document.querySelector<HTMLElement>('.find-trigger')?.focus()
      }
    }
    requestAnimationFrame(restore)
    window.setTimeout(restore, 60)
  }

  // iOS never shrinks dvh for the virtual keyboard, so measure it and pad the list by that much.
  useEffect(() => {
    const vv = window.visualViewport
    const d = ref.current
    if (!open || !vv || !d) return
    const sync = () => d.style.setProperty('--find-kb', `${Math.max(0, window.innerHeight - vv.height)}px`)
    sync()
    vv.addEventListener('resize', sync)
    return () => { vv.removeEventListener('resize', sync); d.style.removeProperty('--find-kb') }
  }, [open])

  // ---- status ------------------------------------------------------------------------------------

  useEffect(() => {
    if (!typed) { setStatus(''); return }
    const n = groups.find((g) => g.id === 'g:cities')?.rows.length ?? 0
    const m = groups.find((g) => g.id === 'g:places')?.rows.length ?? 0
    const say = !n && !m ? 'nothing' : [n && `${n} ${n === 1 ? 'city' : 'cities'}`, m && `${m} ${m === 1 ? 'place' : 'places'}`].filter(Boolean).join(', ')
    const t = window.setTimeout(() => setStatus(say), 500)
    return () => window.clearTimeout(t)
  }, [typed, groups])

  // ---- keys --------------------------------------------------------------------------------------

  const onKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    const nav = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp', 'Enter'].includes(e.key)
    // A keyboard on a touch device opens the panel with the pane focused, not the input. Bridge it,
    // or Arrow and Enter are dead until the user blind-tabs into the field.
    if ((nav || (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey)) && document.activeElement === ref.current) {
      inputRef.current?.focus()
      if (!nav) { e.preventDefault(); setQ((s) => s + e.key); return }
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break
      case 'ArrowUp': e.preventDefault(); move(-1); break
      case 'Home': e.preventDefault(); setActiveKey(rows[0]?.key ?? null); break
      case 'End': e.preventDefault(); setActiveKey(rows[rows.length - 1]?.key ?? null); break
      case 'PageDown': e.preventDefault(); move(5); break
      case 'PageUp': e.preventDefault(); move(-5); break
      case 'Enter':
        if (active && !active.disabled) { e.preventDefault(); active.activate() }
        break
    }
  }

  const showBack = !typed && body === 'browse'

  return (
    <dialog ref={ref} className="dialog-find" tabIndex={-1} onClose={handleClose} onKeyDown={onKeyDown}
      onClick={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="dialog dialog--find">
        <div className="words find-head">
          {typed && <button type="button" className="word word--quiet" onClick={() => { setQ(''); inputRef.current?.focus() }}>clear</button>}
          {showBack && <button type="button" className="word word--quiet" onClick={() => { setBody('standing'); setNearestFirst(null) }}>back</button>}
          <button type="button" className="word word--quiet" onClick={close}>close</button>
        </div>
        <div>
          <label className="vh" htmlFor="find-input">Find a city or a place</label>
          <input
            ref={inputRef} id="find-input" className="search find-input" type="text" value={q}
            onChange={(e) => setQ(e.target.value)}
            role="combobox" aria-expanded aria-controls="find-list" aria-autocomplete="list"
            aria-activedescendant={activeKey ? `find-opt-${activeKey}` : undefined}
            aria-describedby="find-hint"
            placeholder="a city, a park, a street"
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            inputMode="search" enterKeyHint="go"
          />
          <p id="find-hint" className="vh">Results update as you type. Up and down arrows move through them, Enter opens, Escape closes.</p>
        </div>
        <div className="find-list" ref={listRef}>
          {note && <p className="find-note">{note}</p>}
          {nothing && <p className="find-note">Nothing called “{q.trim()}” — try fewer letters.</p>}
          <div id="find-list" role="listbox" aria-label="Places">
            {groups.map((g) => {
              const inner = g.rows.map((r) => (
                <div
                  key={r.key} id={`find-opt-${r.key}`} role="option" className={`find-row${r.wrap ? ' find-row--wrap' : ''}`}
                  aria-selected={r.key === activeKey} aria-label={r.ariaLabel} aria-disabled={r.disabled || undefined}
                  onPointerDown={(e) => { if (e.pointerType === 'mouse') e.preventDefault() }}
                  onPointerMove={(e) => { if (e.pointerType === 'mouse') setActiveKey(r.key) }}
                  onClick={() => { if (!r.disabled) r.activate() }}
                >
                  <span className="find-name">{r.current && <span className="current-dot" aria-hidden="true" />}{r.name}</span>
                  {r.when && <span className="find-when mono" aria-hidden="true">{r.when}</span>}
                  {r.sub && <span className="find-sub">{r.sub}</span>}
                  {r.tail && <span className="find-tail mono" aria-hidden="true">{r.tail}</span>}
                </div>
              ))
              return g.heading ? (
                <div className="find-group" role="group" aria-labelledby={`find-h-${g.id}`} key={g.id}>
                  <p className="region-head" id={`find-h-${g.id}`}>{g.heading}</p>
                  {inner}
                </div>
              ) : (
                <div className="find-group" key={g.id}>{inner}</div>
              )
            })}
          </div>
        </div>
        <p className="vh" role="status" aria-live="polite">{status}</p>
      </div>
    </dialog>
  )
}
