import { describe, expect, it } from 'vitest'
import { search, fold, hitHash } from '../lib/search'

const names = (q: string, n = 6) => search(q, n).map((h) => (h.kind === 'city' ? h.city.name : h.spot.name))

describe('fold', () => {
  it('strips accents and case', () => {
    expect(fold('Montréal')).toBe('montreal')
    expect(fold('CAFÉ')).toBe('cafe')
  })
})

describe('search', () => {
  it('returns nothing for an empty or blank query', () => {
    expect(search('')).toEqual([])
    expect(search('   ')).toEqual([])
  })

  it('puts the city first when the query is a city name', () => {
    const hits = search('tokyo', 8)
    expect(hits[0].kind).toBe('city')
    expect(hits[0].kind === 'city' && hits[0].city.slug).toBe('tokyo')
  })

  it('finds a city by prefix', () => {
    expect(names('barcel')).toContain('Barcelona')
  })

  it('finds a spot by its own name, not just its city', () => {
    const hits = search('kiyosumi', 8)
    expect(hits[0].kind).toBe('spot')
    expect(hits[0].kind === 'spot' && hits[0].spot.name).toBe('Kiyosumi Garden')
  })

  it('matches accented names from unaccented input', () => {
    expect(names('cafe de jaren')).toContain('Café de Jaren')
  })

  it('finds a spot by its neighbourhood', () => {
    expect(search('shinjuku', 10).some((h) => h.kind === 'spot')).toBe(true)
  })

  it('ranks an exact name above a mid-word substring', () => {
    const hits = search('park', 20)
    const exact = hits.findIndex((h) => h.kind === 'spot' && /^park\b/i.test(h.spot.name))
    const buried = hits.findIndex((h) => h.kind === 'spot' && /\wpark/i.test(h.spot.name))
    if (exact !== -1 && buried !== -1) expect(exact).toBeLessThan(buried)
  })

  it('honours the limit', () => {
    expect(search('a', 5)).toHaveLength(5)
  })

  it('is stable across repeated calls', () => {
    expect(names('gard', 8)).toEqual(names('gard', 8))
  })

  it('finds spots by category word', () => {
    expect(search('library', 10).some((h) => h.kind === 'spot' && h.spot.category === 'library')).toBe(true)
  })

  it('builds a route for each hit', () => {
    for (const h of search('tokyo', 5)) expect(hitHash(h)).toMatch(/^#\/(c|s)\//)
  })
})
