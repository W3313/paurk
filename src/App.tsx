import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cities, cityBySlug, spotsByCity } from './data'
import { actions, useStore, type Weather } from './store'
import { distanceKm } from './lib/geo'
import { nearestCity } from './components/AroundYou'
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
import { CityColumn } from './components/CityColumn'
import { StonesPage } from './components/StonesPage'
import { CityDialog } from './components/CityDialog'
import { AboutDialog } from './components/AboutDialog'
import { HorizonClock } from './components/HorizonClock'
import { Sheet, scrollSheetToPeek } from './components/Sheet'
import { MarginNote } from './components/MarginNote'
import { PlateCaption } from './components/PlateCaption'
import { PhaseLine } from './components/SkyText'
import { formatClock } from './lib/time'
import { phaseLine } from './lib/phase'

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
  const live = useNow()
  const [cityOpen, setCityOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useOnlineWatcher()

  const city = citySlug ? cityBySlug.get(citySlug) ?? null : null
  const guess = useMemo(() => guessCity(cities, live), [live])
  const skyPlace = guess ?? cities[0] ?? null
  const skyPos = userPos ?? skyPlace
  const skyTz = userPos ? Intl.DateTimeFormat().resolvedOptions().timeZone : (skyPlace?.timezone ?? 'UTC')
  const cityNow = useCityNow(city, city?.timezone ?? 'UTC')
  const skySun = useMemo(() => (skyPos ? sunInfo(live, skyPos) : null), [live, skyPos])
  const contextSun = city ? cityNow.sun : skySun
  const inCity = mode === 'city' || mode === 'spot'

  // Globe markers: every city (disc filled when it holds stones) + the user ring.
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
      : mode === 'stones' ? 'Stones · Paurk'
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
    document.body.classList.toggle('is-locked', inCity || mode === 'stones')
    return () => document.body.classList.remove('is-locked')
  }, [mobile, inCity, mode])

  // Keyboard: Escape steps back; "a" toggles ambient.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (document.querySelector('dialog[open]')) return
      if (e.key === 'Escape') { if (document.documentElement.dataset.ambient !== undefined) actions.setAmbient(false); else if (mode === 'spot') actions.backToList(); else if (mode === 'city' || mode === 'stones') actions.sky() }
      else if (e.key === 'a' && !e.metaKey && !e.ctrlKey) actions.setAmbient(document.documentElement.dataset.ambient === undefined)
      else if (document.documentElement.dataset.ambient !== undefined) actions.setAmbient(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  const seat: [number, number] = mode === 'sky' ? [0.5, 0.5] : mobile ? [0.5, 0.4] : [0.42, 0.45]
  const paperweight = mobile && (inCity || mode === 'stones') && sheetProgress >= 0.9
  const sunDate = city && cityNow.preview ? cityNow.now : null
  const originIsReal = !!userPos && !!city && distanceKm(userPos, city) <= 80 && (accuracy === null || accuracy < 50000)
  const origin = originIsReal ? userPos : null

  const column = mode === 'stones' ? <StonesPage /> : city && cityNow.sun ? (
    <CityColumn city={city} now={cityNow.now} live={cityNow.live} sun={cityNow.sun} preview={cityNow.preview} origin={origin} originIsReal={originIsReal} mobile={mobile} spotId={mode === 'spot' ? spotId : null} />
  ) : null

  return (
    <>
      <div className="horizon" aria-hidden="true" />
      <HorizonClock sun={contextSun} mobile={mobile} />
      <div className="app" data-mode={mode}>
        <Header onChooseCity={() => setCityOpen(true)} onAbout={() => setAboutOpen(true)} scrolled={scrolled} />
        <main className={mode === 'sky' ? 'sky' : 'city'}>
          <div className={`stage${paperweight ? ' paperweight' : ''}`} onClick={paperweight ? scrollSheetToPeek : undefined} role={paperweight ? 'button' : undefined} aria-label={paperweight ? 'Back to the globe' : undefined}>
            <div className="globe-shadow" aria-hidden="true" />
            <GlobeView markers={markers} selectedId={citySlug} seat={seat} still={still} sunDate={sunDate} pushBack={mobile ? sheetProgress : 0} paused={paperweight} autoRotate={mode === 'sky'} themeKey={theme} onSelect={onSelect} />
            <div className="veil" aria-hidden="true" style={{ opacity: mode === 'sky' ? 1 : 0 }} />
          </div>
          {mobile && city && mode === 'city' && cityNow.sun && (
            <div className="stage-caption" aria-hidden="true">
              <PlateCaption parts={[city.name.toLowerCase(), `${spotsByCity.get(city.slug)?.length ?? 0} places`, formatClock(cityNow.now, city.timezone)]} />
              <PhaseLine text={phaseLine(cityNow.now, cityNow.sun, city.timezone, { preview: cityNow.preview })} />
            </div>
          )}
          {mode === 'sky' ? (
            <SkyText now={live} sun={skySun} place={skyPlace} userPos={userPos} timeZone={skyTz} onChooseCity={() => setCityOpen(true)} onAbout={() => setAboutOpen(true)} />
          ) : mobile ? (
            <Sheet fullOnMount={mode === 'spot'} bare={mode === 'spot'} sticky={mode === 'spot' ? null : <p className="city-name" style={{ fontSize: 'var(--t-display-s)' }}>{mode === 'stones' ? 'stones' : city?.name}</p>}>
              {column}
              <p className="only-mobile" style={{ paddingTop: 24 }}><button type="button" className="word word--quiet word--small" onClick={() => setAboutOpen(true)}>about</button>{' '}<button type="button" className="word word--quiet word--small" onClick={() => actions.sky()}>← sky</button></p>
            </Sheet>
          ) : (
            <aside className="column" aria-label={mode === 'stones' ? 'Saved spots' : city?.name} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}>
              {mode === 'stones' && <p><button type="button" className="word word--quiet" onClick={() => actions.sky()}>← sky</button></p>}
              {column}
            </aside>
          )}
        </main>
        {(mode === 'spot' || mode === 'stones') && <div className="vh"><MarginNote /></div>}
      </div>
      <CityDialog open={cityOpen} onClose={() => setCityOpen(false)} current={citySlug} now={live}
        onPick={(slug) => { setCityOpen(false); const g = getGlobe(); if (g) g.select(slug); else actions.openCity(slug) }} />
      <AboutDialog open={aboutOpen} onClose={() => { setAboutOpen(false); if (mode === 'about') actions.sky() }} />
    </>
  )
}
