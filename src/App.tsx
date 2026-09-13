import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cities, cityBySlug, spotsByCity } from './data'
import { actions, useStore, type Mode, type Weather } from './store'
import { distanceKm } from './lib/geo'
import { nearestCity } from './lib/locate'
import { useNow } from './hooks/useNow'
import { useCityNow } from './hooks/useCityNow'
import { useOnlineWatcher } from './hooks/useOnline'
import { sunInfo } from './lib/time'
import { guessCity } from './lib/phase'
import { fetchWeather } from './lib/weather'
import { getGlobe } from './globe/handle'
import type { GlobeMarker } from './globe/GlobeEngine'
import { GlobeView } from './components/GlobeView'
import { Header } from './components/Header'
import { SkyText } from './components/SkyText'
import { CityMenu } from './components/CityMenu'
import { CityColumn } from './components/CityColumn'
import { SavedPage } from './components/SavedPage'
import { Find } from './components/Find'
import { AboutDialog } from './components/AboutDialog'
import { HorizonClock } from './components/HorizonClock'
import { Sheet } from './components/Sheet'
import { MarginNote } from './components/MarginNote'

/** Viewport in pixels, kept fresh, because the globe's seat and size are computed from it. */
function useViewport() {
  const [v, setV] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const on = () => setV({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return v
}

const headerPx = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 56
const columnPx = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--column')) || 400

/**
 * Where the sphere sits and how big it is. The canvas is the whole page, so the sphere's size is a
 * deliberate fraction rather than whatever the container happened to be — which is what stops a zoom
 * from ever reaching the canvas edge and showing a square.
 */
function globeFrame(mode: Mode, mobile: boolean, v: { w: number; h: number }) {
  const canvasH = Math.max(1, v.h - headerPx())
  const short = Math.min(v.w, canvasH)
  if (mobile) {
    // Sky puts the globe above the list. Elsewhere it sits higher and smaller, because selecting a
    // city flies the camera in by about half again and nothing clips it back any more.
    const target = mode === 'sky' ? short * 0.9 : short * 0.52
    return { seat: [0.5, mode === 'sky' ? 0.3 : 0.2] as [number, number], fit: target / short, radius: target / 2 }
  }
  const col = columnPx()
  // One panel or the other owns a column; the sphere is centred in whatever is left.
  const free = Math.max(240, v.w - col)
  const target = Math.min(free, canvasH) * 0.84
  const x = mode === 'sky' ? 0.5 + col / (2 * v.w) : 0.5 - col / (2 * v.w)
  return { seat: [x, 0.5] as [number, number], fit: target / short, radius: target / 2 }
}

function useMedia(q: string) {
  const [m, setM] = useState(() => matchMedia(q).matches)
  useEffect(() => { const mq = matchMedia(q); const on = () => setM(mq.matches); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on) }, [q])
  return m
}

export default function App() {
  const mode = useStore((s) => s.mode)
  const citySlug = useStore((s) => s.citySlug)
  const spotId = useStore((s) => s.spotId)
  const userPos = useStore((s) => s.userPos)
  const savedIds = useStore((s) => s.savedIds)
  const still = useStore((s) => s.still)
  const theme = useStore((s) => s.theme)
  const sheetProgress = useStore((s) => s.sheetProgress)
  const accuracy = useStore((s) => s.userAccuracyM)
  const mobile = useMedia('(max-width: 899px)')
  const viewport = useViewport()
  const live = useNow()
  const [findOpen, setFindOpen] = useState(false)
  /** Whether Find was opened by "all 44 cities", which asks for the browse body rather than the default. */
  const [findBrowse, setFindBrowse] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  useOnlineWatcher()

  const city = citySlug ? cityBySlug.get(citySlug) ?? null : null
  const guess = useMemo(() => guessCity(cities, live), [live])
  const skyPlace = guess ?? cities[0] ?? null
  const skyPos = userPos ?? skyPlace
  const cityNow = useCityNow(city, city?.timezone ?? 'UTC')
  const skySun = useMemo(() => (skyPos ? sunInfo(live, skyPos) : null), [live, skyPos])
  const contextSun = city ? cityNow.sun : skySun
  const inCity = mode === 'city' || mode === 'spot'

  // Globe markers: every city (disc filled when it holds saved spots) + the user ring.
  const markers = useMemo<GlobeMarker[]>(() => {
    const m: GlobeMarker[] = cities.map((c) => ({ id: c.slug, lat: c.lat, lng: c.lng, label: c.name, kind: 'city', filled: savedIds.some((id) => id.startsWith(`${c.slug}/`)) }))
    if (userPos) m.push({ id: 'user', lat: userPos.lat, lng: userPos.lng, label: 'you', kind: 'user', approx: (accuracy ?? 0) > 2000 })
    return m
  }, [savedIds, userPos, accuracy])

  // Flights follow the selected city; the sky releases the camera.
  const flown = useRef<string | null>(null)
  useEffect(() => {
    const g = getGlobe()
    if (!g) return
    if (citySlug && city && inCity) {
      if (flown.current !== citySlug) { flown.current = citySlug; g.select(citySlug, false); void g.flyTo(city.lat, city.lng, 1.45, 1800) }
      g.autoRotate = false
    } else if (mode === 'sky') {
      if (flown.current !== null) { flown.current = null; g.select(null, false); void g.release() }
      g.autoRotate = true
    }
  }, [citySlug, city, inCity, mode])
  // Once the engine exists: face the place we know about, or land straight on a deep-linked city.
  const globeReady = useStore((s) => s.globeReady)
  const globe2d = useStore((s) => s.globe2d)
  useEffect(() => {
    const g = getGlobe()
    if (!globeReady || !g) return
    if (citySlug && city && inCity) { if (flown.current !== citySlug) { flown.current = citySlug; g.select(citySlug, false); void g.flyTo(city.lat, city.lng, 1.45, 0) } }
    else if (skyPos) g.lookAt(skyPos.lat, skyPos.lng)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globeReady])

  const onSelect = useCallback((id: string | null) => {
    if (id) { if (id !== 'user') actions.openCity(id) }
    else if (inCity) actions.sky()
  }, [inCity])

  // Weather for the city on screen (or the nearest city to you on the sky), once per 20 minutes per city.
  // Only city-centre coordinates are ever sent; your own position never leaves the device.
  const weatherCache = useRef(new Map<string, Weather | null>())
  const weatherCity = city ?? (userPos ? nearestCity(userPos).city : null)
  const weatherKey = weatherCity && (city || (userPos && distanceKm(userPos, weatherCity) <= 80)) ? weatherCity.slug : null
  useEffect(() => {
    if (!weatherKey || !weatherCity) { actions.setWeather(null); return }
    const pos = weatherCity
    const cached = weatherCache.current.get(weatherKey)
    actions.setWeather(cached && Date.now() - cached.fetchedAt < 20 * 60000 ? cached : null)
    if (cached && Date.now() - cached.fetchedAt < 20 * 60000) return
    let alive = true
    void fetchWeather(pos).then((wx) => {
      if (!wx) return
      const w = { ...wx, key: weatherKey }
      weatherCache.current.set(weatherKey, w)
      if (alive) actions.setWeather(w)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weatherKey])

  // The tab, the history entry and anything that reads the title follow the route.
  useEffect(() => {
    const spot = spotId ? spotsByCity.get(spotId.split('/')[0])?.find((x) => x.id === spotId) : null
    const title =
      mode === 'spot' && spot && city ? `${spot.name}, ${city.name} · Paurk`
      : mode === 'city' && city ? `${city.name} · Paurk`
      : mode === 'saved' ? 'Saved · Paurk'
      : 'Paurk · somewhere to breathe, wherever, whenever'
    document.title = title
  }, [mode, city, spotId])

  // Notes on arrival.
  useEffect(() => {
    if (city && mode === 'city') {
      const n = spotsByCity.get(city.slug)?.length ?? 0
      actions.note(`${n} places · tap a row to open it`)
    }
  }, [city, mode])
  useEffect(() => { if (mode === 'about') { setAboutOpen(true) } }, [mode])
  useEffect(() => {
    if (!mobile) return
    document.body.classList.toggle('is-locked', inCity || mode === 'saved')
    return () => document.body.classList.remove('is-locked')
  }, [mobile, inCity, mode])
  /*
   * Where focus goes when the screen changes. Three of the four transitions used to drop it on <body>
   * — opening a city, coming back from a spot, and returning to the sky — which restarts the next Tab at
   * the top of the document and leaves a screen reader with no idea anything happened. The spot page
   * already moved focus to its own heading; this does the same for the rest, onto the region that just
   * arrived. Skipped on first paint, since nothing has changed yet and stealing focus on load is rude.
   */
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    if (mode === 'spot') return // SpotPage focuses its own heading
    // By intent, not by document order: a selector list picks the first match in the DOM, which is
    // .side--cities — and that column is inert whenever a city is open, so the focus call did nothing
    // and focus stayed on <body>, which is the bug this effect exists to fix.
    const want = mode === 'sky'
      ? (mobile ? '.sky-text' : '.side--cities')
      : (mobile ? '[data-sheet]' : '.side--spots')
    mainRef.current?.querySelector<HTMLElement>(want)?.focus({ preventScroll: true })
  }, [mode, citySlug, mobile])

  // The sky is the one screen that scrolls the document itself rather than a panel, so nothing was
  // feeding `scrolled` there and the header never went opaque — it printed "44 cities" through itself.
  useEffect(() => {
    if (!mobile || mode !== 'sky') return
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [mobile, mode])

  // Keyboard: "/" opens find; Escape steps back; "a" toggles ambient.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (document.querySelector('dialog[open]')) return
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); setFindOpen(true) }
      else if (e.key === 'Escape') { if (document.documentElement.dataset.ambient !== undefined) actions.setAmbient(false); else if (mode === 'spot') actions.backToList(); else if (mode === 'city' || mode === 'saved') actions.sky() }
      else if (e.key === 'a' && !e.metaKey && !e.ctrlKey) actions.setAmbient(document.documentElement.dataset.ambient === undefined)
      else if (document.documentElement.dataset.ambient !== undefined) actions.setAmbient(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  const { seat, fit, radius } = globeFrame(mode, mobile, viewport)
  // The paper is opaque and reaches the top of the sheet, so once the run-up is spent the canvas is
  // fully behind it: stop rendering, and take a focusable role="application" widget out of the tab order.
  const covered = mobile && (inCity || mode === 'saved') && sheetProgress >= 0.98
  // inert drops focus to <body> if it lands on a focused descendant, and the canvas is one. Hand focus
  // to the sheet instead, so the tab order carries on from where the reader is.
  useEffect(() => {
    if (!covered) return
    const el = stageRef.current
    if (el && document.activeElement instanceof HTMLElement && el.contains(document.activeElement)) {
      document.querySelector<HTMLElement>('[data-sheet]')?.focus({ preventScroll: true })
    }
  }, [covered])
  const sunDate = city && cityNow.preview ? cityNow.now : null
  const originIsReal = !!userPos && !!city && distanceKm(userPos, city) <= 80 && (accuracy === null || accuracy < 50000)
  const origin = originIsReal ? userPos : null

  // One step back: a spot returns to its city's list, anything else to the globe.
  const goBack = useCallback(() => { if (mode === 'spot') actions.backToList(); else actions.sky() }, [mode])

  const column = mode === 'saved' ? <SavedPage /> : city && cityNow.sun ? (
    <CityColumn city={city} now={cityNow.now} live={cityNow.live} sun={cityNow.sun} preview={cityNow.preview} origin={origin} originIsReal={originIsReal} mobile={mobile} spotId={mode === 'spot' ? spotId : null} />
  ) : null

  return (
    <>
      <div className="horizon" aria-hidden="true" />
      <HorizonClock sun={contextSun} mobile={mobile} />
      <div className="app" data-mode={mode}>
        <Header onSearch={() => { setFindBrowse(false); setFindOpen(true) }} onAbout={() => setAboutOpen(true)} scrolled={scrolled || (mobile && sheetProgress > 0.05)} />
        <main ref={mainRef} className={mobile ? (mode === 'sky' ? 'sky' : 'city') : 'shell'} data-sky={mode === 'sky' ? '' : undefined}
          style={{ '--seat-x': seat[0], '--seat-y': seat[1], '--globe-r': `${Math.round(radius)}px` } as React.CSSProperties}>
          <div className="stage" ref={stageRef} {...(covered ? { inert: true } : {})}>
            {/* The contact shadow is placed from the seat and radius the WebGL sphere reports. With the 2D
                fallback up there is no such sphere, and it painted an orphan blob below the flat canvas. */}
            {!globe2d && <div className="globe-shadow" aria-hidden="true" />}
            <GlobeView markers={markers} selectedId={citySlug} seat={seat} fit={fit} still={still} sunDate={sunDate} pushBack={mobile ? sheetProgress : 0} paused={covered} autoRotate={mode === 'sky'} themeKey={theme} onSelect={onSelect} />
          </div>
          {mobile ? (
            mode === 'sky' ? (
              <SkyText now={live} userPos={userPos} onAll={() => { setFindBrowse(true); setFindOpen(true) }} onAbout={() => setAboutOpen(true)} />
            ) : (
              <Sheet bare={mode === 'spot'} label={mode === 'saved' ? 'Saved spots' : city?.name ?? 'Place'}
                onBack={goBack} backWord={mode === 'spot' && city ? `← ${city.name}` : '← globe'}
                sticky={<p className="city-name" style={{ fontSize: 'var(--t-display-s)' }}>{mode === 'saved' ? 'saved' : city?.name}</p>}>
                {column}
                <p className="only-mobile" style={{ paddingTop: 24 }}><button type="button" className="word word--quiet word--small" onClick={() => setAboutOpen(true)}>about</button></p>
              </Sheet>
            )
          ) : (
            <>
              {/* Both panels stay mounted so each can slide rather than blink. */}
              <aside className="side side--cities" aria-label="All cities" tabIndex={-1} {...(mode === 'sky' ? {} : { inert: true })}>
                <CityMenu now={live} current={citySlug} live={mode === 'sky'} />
              </aside>
              <aside className="side side--spots" aria-label={mode === 'saved' ? 'Saved spots' : city?.name ?? 'Places'} tabIndex={-1}
                {...(mode === 'sky' ? { inert: true } : {})}
                onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}>
                <div className="column">
                  {mode === 'saved' && <p><button type="button" className="word word--quiet" onClick={() => actions.sky()}>← sky</button></p>}
                  {column}
                </div>
              </aside>
            </>
          )}
        </main>
        {(mode === 'spot' || mode === 'saved') && <div className="vh"><MarginNote /></div>}
      </div>
      <Find open={findOpen} startInBrowse={findBrowse} onClose={() => setFindOpen(false)} now={live} />
      <AboutDialog open={aboutOpen} onClose={() => { setAboutOpen(false); if (mode === 'about') actions.sky() }} />
    </>
  )
}
