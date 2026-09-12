import { getState, setState, subscribe, type State } from '../store'
import { cityBySlug, spotById } from '../data'
import type { Vibe } from '../types'

const VIBES = new Set<string>(['quiet','sunset','sunrise','night','view','water','green','cozy','rain-ok','solo','group','free','people-watch','study','stargaze','picnic','walk','skyline','hidden'])

/** Hash routes: #/ · #/c/<city> · #/s/<city>/<spot> · #/saved · #/about, plus ?v=quiet,free and ?t=HHMM */
export function parseHash(hash: string): Partial<State> | null {
  const raw = hash.replace(/^#\/?/, '')
  const [pathPart, query = ''] = raw.split('?')
  const params = new URLSearchParams(query)
  const vibes = (params.get('v') ?? '').split(',').filter((v) => VIBES.has(v)) as Vibe[]
  const t = params.get('t')
  let pinnedMinutes: number | null = null
  if (t && /^\d{3,4}$/.test(t)) {
    const h = Number(t.slice(0, -2)), m = Number(t.slice(-2))
    if (h < 24 && m < 60) pinnedMinutes = h * 60 + m
  }
  const base: Partial<State> = { vibes, pinnedMinutes, previewMinutes: pinnedMinutes }
  const [kind, a, b] = pathPart.split('/')
  if (!pathPart) return { ...base, mode: 'sky', citySlug: null, spotId: null }
  // #/stones is the old name for this route; keep parsing it so shared links survive.
  if (kind === 'saved' || kind === 'stones') return { ...base, mode: 'saved' }
  if (kind === 'about') return { ...base, mode: 'about' }
  if (kind === 'c' && a && cityBySlug.has(a)) return { ...base, mode: 'city', citySlug: a, spotId: null }
  if (kind === 's' && a && b) {
    const id = `${a}/${b}`
    if (spotById.has(id)) return { ...base, mode: 'spot', citySlug: a, spotId: id }
  }
  return null
}

export function hashFor(s: State = getState()): string {
  let path = '#/'
  if (s.mode === 'spot' && s.spotId) path = `#/s/${s.spotId}`
  else if (s.mode === 'city' && s.citySlug) path = `#/c/${s.citySlug}`
  else if (s.mode === 'saved') path = '#/saved'
  else if (s.mode === 'about') path = '#/about'
  const q = new URLSearchParams()
  if (s.vibes.length) q.set('v', s.vibes.join(','))
  if (s.pinnedMinutes !== null) q.set('t', `${String(Math.floor(s.pinnedMinutes / 60)).padStart(2, '0')}${String(s.pinnedMinutes % 60).padStart(2, '0')}`)
  const qs = q.toString()
  return qs ? `${path}?${qs}` : path
}

let applying = false
let timer: number | undefined
export function startRouter() {
  const apply = () => {
    const r = parseHash(location.hash)
    applying = true
    setState(r ?? { mode: 'sky', citySlug: null, spotId: null })
    applying = false
    const canonical = hashFor()
    if (location.hash !== canonical) history.replaceState(null, '', canonical)
  }
  apply()
  window.addEventListener('hashchange', apply)
  subscribe(() => {
    if (applying) return
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      const h = hashFor()
      if (location.hash === h) return
      const path = (x: string) => x.split('?')[0]
      if (path(location.hash || '#/') === path(h)) history.replaceState(null, '', h)
      else history.pushState(null, '', h)
    }, 120)
  })
}
