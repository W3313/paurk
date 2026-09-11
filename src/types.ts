export type Category =
  | 'park' | 'garden' | 'waterfront' | 'viewpoint' | 'beach' | 'trail' | 'plaza' | 'rooftop'
  | 'cafe' | 'library' | 'bookstore' | 'museum' | 'indoor' | 'market' | 'other'

export type Vibe =
  | 'quiet' | 'sunset' | 'sunrise' | 'night' | 'view' | 'water' | 'green' | 'cozy' | 'rain-ok'
  | 'solo' | 'group' | 'free' | 'people-watch' | 'study' | 'stargaze' | 'picnic' | 'walk' | 'skyline' | 'hidden'

export type BestTime = 'morning' | 'afternoon' | 'golden-hour' | 'night'
export type SourceKind = 'reddit' | 'forum' | 'blog' | 'press' | 'official' | 'other'

export interface Source { url: string; label: string; kind: SourceKind }

export interface Spot {
  id: string
  city: string
  name: string
  neighborhood: string
  category: Category
  vibes: Vibe[]
  blurb: string
  tips: string
  bestTimes: BestTime[]
  indoor: boolean
  free: boolean
  hours: string
  lat: number
  lng: number
  coordConfidence: 'high' | 'medium' | 'low'
  wikipediaTitle: string | null
  sources: Source[]
  safety: { level: 'ok' | 'caution'; note: string }
  lowkeyScore: number
  /** false when the independent review stage did not run for this spot */
  verified: boolean
}

export interface City {
  slug: string
  name: string
  country: string
  region: string
  lat: number
  lng: number
  timezone: string
  spotCount: number
  verified: boolean
}

export interface Dataset { cities: City[]; spots: Spot[] }

export interface LatLng { lat: number; lng: number }
