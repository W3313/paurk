import { useSyncExternalStore } from 'react'
import type { LatLng, Vibe } from './types'

export type Mode = 'globe' | 'city' | 'spot' | 'saved' | 'about'

export interface Weather {
  code: number
  tempC: number
  isRaining: boolean
  fetchedAt: number
}

export interface State {
  mode: Mode
  citySlug: string | null
  spotId: string | null
  vibes: Vibe[]
  userPos: LatLng | null
  geoStatus: 'idle' | 'asking' | 'granted' | 'denied' | 'unsupported'
  savedIds: string[]
  weather: Weather | null
  units: 'metric' | 'imperial'
  /** Time override for the "whenever" dial; null = live clock. */
  timeOverride: Date | null
  toast: string | null
  globeReady: boolean
}

const SAVED_KEY = 'tc.saved.v1'
const UNITS_KEY = 'tc.units.v1'

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}

let state: State = {
  mode: 'globe',
  citySlug: null,
  spotId: null,
  vibes: [],
  userPos: null,
  geoStatus: 'idle',
  savedIds: load<string[]>(SAVED_KEY, []),
  weather: null,
  units: load<'metric' | 'imperial'>(UNITS_KEY, navigator.language === 'en-US' ? 'imperial' : 'metric'),
  timeOverride: null,
  toast: null,
  globeReady: false,
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

// ---- actions ----
export const actions = {
  openCity(slug: string) { setState({ mode: 'city', citySlug: slug, spotId: null }) },
  openSpot(id: string, citySlug?: string) { setState((s) => ({ mode: 'spot', spotId: id, citySlug: citySlug ?? s.citySlug })) },
  backToCity() { setState((s) => ({ mode: s.citySlug ? 'city' : 'globe', spotId: null })) },
  home() { setState({ mode: 'globe', spotId: null, citySlug: null }) },
  setMode(mode: Mode) { setState({ mode }) },
  toggleVibe(v: Vibe) {
    setState((s) => ({ vibes: s.vibes.includes(v) ? s.vibes.filter((x) => x !== v) : [...s.vibes, v] }))
  },
  clearVibes() { setState({ vibes: [] }) },
  toggleSaved(id: string) {
    setState((s) => {
      const savedIds = s.savedIds.includes(id) ? s.savedIds.filter((x) => x !== id) : [...s.savedIds, id]
      try { localStorage.setItem(SAVED_KEY, JSON.stringify(savedIds)) } catch { /* ignore */ }
      return { savedIds, toast: s.savedIds.includes(id) ? 'Removed from your stash' : 'Stashed for later' }
    })
  },
  setUnits(units: 'metric' | 'imperial') {
    try { localStorage.setItem(UNITS_KEY, JSON.stringify(units)) } catch { /* ignore */ }
    setState({ units })
  },
  setUserPos(pos: LatLng | null, geoStatus: State['geoStatus']) { setState({ userPos: pos, geoStatus }) },
  setWeather(weather: Weather | null) { setState({ weather }) },
  setTimeOverride(d: Date | null) { setState({ timeOverride: d }) },
  toast(msg: string | null) { setState({ toast: msg }) },
  globeReady() { setState({ globeReady: true }) },
}

let toastTimer: number | undefined
subscribe(() => {
  if (state.toast) {
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => setState({ toast: null }), 2400)
  }
})
