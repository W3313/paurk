import { useSyncExternalStore } from 'react'
import type { LatLng, Vibe } from './types'

export type Mode = 'sky' | 'city' | 'spot' | 'saved' | 'about'
export type Theme = 'paper' | 'slate' | 'auto'

export interface Weather {
  code: number
  tempC: number
  isRaining: boolean
  isSnowing: boolean
  fetchedAt: number
  key: string
}

export interface State {
  mode: Mode
  citySlug: string | null
  spotId: string | null
  vibes: Vibe[]
  userPos: LatLng | null
  userAccuracyM: number | null
  geoStatus: 'idle' | 'asking' | 'granted' | 'denied' | 'unsupported'
  savedIds: string[]
  weather: Weather | null
  units: 'metric' | 'imperial'
  /** minutes since local midnight (city-local) being previewed on the sun-rule, or null = live */
  previewMinutes: number | null
  pinnedMinutes: number | null
  theme: Theme
  still: boolean
  ambient: boolean
  /** margin-note lines waiting to be shown */
  notes: string[]
  globeReady: boolean
  sheetProgress: number
  listScroll: Record<string, number>
  heading: number | null
  online: boolean
  visitedCities: string[]
  /** The find panel owns the one live region while it is open, so the margin note must go quiet. */
  findOpen: boolean
}

const SAVED_KEY = 'paurk.saved.v1'
const LATELY_KEY = 'paurk.lately.v1'
const UNITS_KEY = 'paurk.units.v1'
const THEME_KEY = 'paurk.theme.v1'
const STILL_KEY = 'paurk.still.v1'
export const GEO_DENIED_KEY = 'paurk.geo.denied'

export function loadLS<T>(key: string, fallback: T, valid?: (v: unknown) => v is T): T {
  try {
    const v = localStorage.getItem(key)
    if (v === null) return fallback
    const parsed: unknown = JSON.parse(v)
    if (valid) return valid(parsed) ? parsed : fallback
    return parsed as T
  } catch {
    return fallback
  }
}
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string' && x.length < 200)
const isUnits = (v: unknown): v is 'metric' | 'imperial' => v === 'metric' || v === 'imperial'
const isTheme = (v: unknown): v is Theme => v === 'paper' || v === 'slate' || v === 'auto'
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
export function saveLS(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage unavailable */ }
}

const prefersStill = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

let state: State = {
  mode: 'sky',
  citySlug: null,
  spotId: null,
  vibes: [],
  userPos: null,
  userAccuracyM: null,
  geoStatus: typeof navigator !== 'undefined' && !('geolocation' in navigator) ? 'unsupported' : 'idle',
  savedIds: loadLS<string[]>(SAVED_KEY, [], isStringArray),
  weather: null,
  units: loadLS<'metric' | 'imperial'>(UNITS_KEY, typeof navigator !== 'undefined' && navigator.language === 'en-US' ? 'imperial' : 'metric', isUnits),
  previewMinutes: null,
  pinnedMinutes: null,
  theme: loadLS<Theme>(THEME_KEY, 'auto', isTheme),
  still: loadLS<boolean>(STILL_KEY, false, isBool) || prefersStill,
  ambient: false,
  notes: [],
  globeReady: false,
  sheetProgress: 0,
  listScroll: {},
  heading: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  visitedCities: loadLS<string[]>(LATELY_KEY, []),
  findOpen: false,
}

const listeners = new Set<() => void>()
export function getState() { return state }
export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...p }
  for (const l of listeners) l()
}
export function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state))
}

/** Keeps the last few cities you opened, and writes them through so Find's `lately` survives a reload. */
function rememberCity(list: string[], slug: string): string[] {
  const next = [...list.filter((x) => x !== slug), slug].slice(-6)
  saveLS(LATELY_KEY, next)
  return next
}

export const actions = {
  setFindOpen(findOpen: boolean) { setState({ findOpen }) },
  openCity(slug: string) {
    setState((s) => ({ mode: 'city', citySlug: slug, spotId: null, previewMinutes: s.citySlug === slug ? s.previewMinutes : null, pinnedMinutes: s.citySlug === slug ? s.pinnedMinutes : null, visitedCities: s.visitedCities[s.visitedCities.length - 1] === slug ? s.visitedCities : rememberCity(s.visitedCities, slug) }))
  },
  openSpot(id: string) {
    // The same slug guard openCity carries. Without it, opening a Tokyo spot straight from Find while a
    // time was pinned in Amsterdam left that time pinned, so Tokyo was ranked and coloured for an hour
    // the reader had chosen somewhere else entirely.
    const slug = id.split('/')[0]
    setState((s) => ({
      mode: 'spot', spotId: id, citySlug: slug,
      previewMinutes: s.citySlug === slug ? s.previewMinutes : null,
      pinnedMinutes: s.citySlug === slug ? s.pinnedMinutes : null,
      visitedCities: s.visitedCities[s.visitedCities.length - 1] === slug ? s.visitedCities : rememberCity(s.visitedCities, slug),
    }))
  },
  backToList() { setState((s) => ({ mode: s.citySlug ? 'city' : 'sky', spotId: null })) },
  sky() { setState({ mode: 'sky', spotId: null, citySlug: null, previewMinutes: null, pinnedMinutes: null }) },
  setMode(mode: Mode) { setState({ mode }) },
  toggleVibe(v: Vibe) { setState((s) => ({ vibes: s.vibes.includes(v) ? s.vibes.filter((x) => x !== v) : [...s.vibes, v] })) },
  setVibes(vibes: Vibe[]) { setState({ vibes }) },
  clearVibes() { setState({ vibes: [] }) },
  toggleSaved(id: string) {
    setState((s) => {
      const savedIds = s.savedIds.includes(id) ? s.savedIds.filter((x) => x !== id) : [...s.savedIds, id]
      saveLS(SAVED_KEY, savedIds)
      const n = savedIds.length
      return { savedIds, notes: [...s.notes, s.savedIds.includes(id) ? `let go · ${n} saved` : `saved · ${n} in all`] }
    })
  },
  setUnits(units: 'metric' | 'imperial') { saveLS(UNITS_KEY, units); setState({ units }) },
  setUserPos(pos: LatLng | null, geoStatus: State['geoStatus'], accuracyM: number | null = null) {
    if (geoStatus === 'denied') saveLS(GEO_DENIED_KEY, 1)
    setState({ userPos: pos, geoStatus, userAccuracyM: accuracyM })
  },
  setWeather(weather: Weather | null) { setState({ weather }) },
  // Scrubbing away from a pin drops it. It used to survive, and the router writes ?t= from the pin alone,
  // so a copied link could name an hour the reader had already scrubbed off.
  setPreview(previewMinutes: number | null) { setState((s) => ({ previewMinutes, pinnedMinutes: previewMinutes === null || previewMinutes !== s.pinnedMinutes ? null : s.pinnedMinutes })) },
  pin(minutes: number | null) { setState({ pinnedMinutes: minutes, previewMinutes: minutes }) },
  setTheme(theme: Theme) { saveLS(THEME_KEY, theme); setState({ theme }) },
  setStill(still: boolean) { saveLS(STILL_KEY, still); setState({ still }) },
  setAmbient(ambient: boolean) { setState({ ambient }) },
  note(line: string) { setState((s) => (s.notes[s.notes.length - 1] === line ? {} : { notes: [...s.notes, line] })) },
  shiftNote() { setState((s) => ({ notes: s.notes.slice(1) })) },
  globeReady() { setState({ globeReady: true }) },
  setSheetProgress(sheetProgress: number) { if (Math.abs(sheetProgress - state.sheetProgress) > 0.005) setState({ sheetProgress }) },
  rememberScroll(key: string, top: number) { setState((s) => ({ listScroll: { ...s.listScroll, [key]: top } })) },
  setHeading(heading: number | null) { setState({ heading }) },
  setOnline(online: boolean) { setState({ online }) },
}
