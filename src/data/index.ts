import raw from './spots.json'
import type { City, Dataset, Spot } from '../types'

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
