import raw from './spots.json'
import type { City, Dataset, Spot, SpotDetail } from '../types'

export const dataset = raw as unknown as Dataset
export const cities: City[] = dataset.cities
export const spots: Spot[] = dataset.spots
export const cityBySlug = new Map(cities.map((c) => [c.slug, c]))
export const spotById = new Map(spots.map((s) => [s.id, s]))
export const spotsByCity = new Map<string, Spot[]>()
for (const s of spots) {
  const arr = spotsByCity.get(s.city) ?? []
  arr.push(s)
  spotsByCity.set(s.city, arr)
}

/**
 * Blurbs, tips and sources are two thirds of the dataset and are only ever rendered on a spot page,
 * so they live in their own chunk. Vite hashes and caches it like any other asset; the first call
 * starts the download and every later one reuses it.
 */
let detailsPromise: Promise<Record<string, SpotDetail>> | null = null
export function loadDetails(): Promise<Record<string, SpotDetail>> {
  detailsPromise ??= import('./spot-details.json').then((m) => m.default as unknown as Record<string, SpotDetail>)
  return detailsPromise
}
