import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SumiPoster, hash, mulberry32 } from '../components/SumiPoster'
import type { Spot } from '../types'

const base: Spot = {
  id: 'lisbon-miradouro-da-graca',
  city: 'lisbon',
  name: 'Miradouro da Graça',
  neighborhood: 'Graça',
  category: 'viewpoint',
  vibes: ['view', 'sunset'],
  blurb: '',
  tips: '',
  bestTimes: ['golden-hour'],
  indoor: false,
  free: true,
  hours: '',
  lat: 38.716,
  lng: -9.131,
  coordConfidence: 'high',
  wikipediaTitle: null,
  sources: [],
  safety: { level: 'ok', note: '' },
  lowkeyScore: 0.8, verified: true,
}
const spot = (over: Partial<Spot> = {}): Spot => ({ ...base, ...over })
const render = (s: Spot, compact = false) =>
  renderToStaticMarkup(createElement(SumiPoster, { spot: s, cityName: 'Lisbon', compact }))

describe('SumiPoster', () => {
  it('renders an accessible svg image', () => {
    const out = render(spot())
    expect(out).toContain('role="img"')
    expect(out).toContain('aria-label="Poster for Miradouro da Graça"')
    expect(out).toContain('viewBox="0 0 400 300"')
  })

  it('differs between ids and is stable for the same id', () => {
    const a = render(spot())
    const b = render(spot({ id: 'lisbon-jardim-da-estrela', name: 'Jardim da Estrela', category: 'garden' }))
    expect(a).not.toBe(b)
    expect(render(spot())).toBe(a)
    expect(mulberry32(hash('x'))()).toBe(mulberry32(hash('x'))())
  })

  it('draws a hollow ring for the night seal and a solid disc otherwise', () => {
    const night = render(spot({ id: 'lisbon-cais-do-sodre-night', bestTimes: ['night'] }))
    expect(night).toMatch(/<circle[^>]*\br="9"[^>]*fill="none"[^>]*stroke="var\(--accent\)"/)
    expect(render(spot())).toMatch(/<circle[^>]*\br="9"[^>]*fill="var\(--accent\)"/)
  })

  it('keeps ids unique per instance and drops grain and caption when compact', () => {
    const a = render(spot())
    const b = render(spot({ id: 'porto-jardins-do-palacio' }))
    const idOf = (s: string) => /id="(sumi-wash-[a-z0-9]+)"/.exec(s)?.[1]
    expect(idOf(a)).toBeDefined()
    expect(idOf(a)).not.toBe(idOf(b))
    expect(a).toContain('>lisbon</text>')
    expect(a).toContain('sumi-grain-')
    const c = render(spot(), true)
    expect(c).not.toContain('<text')
    expect(c).not.toContain('sumi-grain-')
  })
})
