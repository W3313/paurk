import { getState, setState, subscribe } from '../store'
import { cityBySlug, spotById } from '../data'

/** Hash routes: #/ , #/c/<city> , #/s/<city>/<spot-key> , #/saved , #/about */
export function parseHash(hash: string): Partial<{ mode: 'globe' | 'city' | 'spot' | 'saved' | 'about'; citySlug: string | null; spotId: string | null }> | null {
  const h = hash.replace(/^#\/?/, '')
  if (!h) return { mode: 'globe', citySlug: null, spotId: null }
  const [kind, a, b] = h.split('/')
  if (kind === 'saved') return { mode: 'saved' }
  if (kind === 'about') return { mode: 'about' }
  if (kind === 'c' && a && cityBySlug.has(a)) return { mode: 'city', citySlug: a, spotId: null }
  if (kind === 's' && a && b) {
    const id = `${a}/${b}`
    if (spotById.has(id)) return { mode: 'spot', citySlug: a, spotId: id }
  }
  return null
}

export function hashFor(): string {
  const s = getState()
  if (s.mode === 'spot' && s.spotId) return `#/s/${s.spotId}`
  if (s.mode === 'city' && s.citySlug) return `#/c/${s.citySlug}`
  if (s.mode === 'saved') return '#/saved'
  if (s.mode === 'about') return '#/about'
  return '#/'
}

let applying = false
export function startRouter() {
  const apply = () => {
    const r = parseHash(location.hash)
    if (!r) return
    applying = true
    setState(r)
    applying = false
  }
  apply()
  window.addEventListener('hashchange', apply)
  subscribe(() => {
    if (applying) return
    const h = hashFor()
    if (location.hash !== h) history.replaceState(null, '', h)
  })
}
