import type { LatLng } from '../types'
import type { Weather } from '../store'

/**
 * Optional, keyless current-weather lookup (Open-Meteo, CORS-enabled). Failure
 * is silent: the app simply stops being weather-aware.
 */
export async function fetchWeather(pos: LatLng): Promise<Weather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${pos.lat.toFixed(3)}&longitude=${pos.lng.toFixed(3)}&current=temperature_2m,weather_code,precipitation&timezone=auto`
    const res = await fetch(url)
    if (!res.ok) return null
    const j = (await res.json()) as { current?: { temperature_2m: number; weather_code: number; precipitation: number } }
    if (!j.current) return null
    const code = j.current.weather_code
    const isRaining = j.current.precipitation > 0.1 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95
    return { code, tempC: j.current.temperature_2m, isRaining, fetchedAt: Date.now() }
  } catch {
    return null
  }
}

export function weatherLabel(code: number): string {
  if (code === 0) return 'clear'
  if (code <= 2) return 'mostly clear'
  if (code === 3) return 'overcast'
  if (code <= 48) return 'foggy'
  if (code <= 57) return 'drizzle'
  if (code <= 67) return 'rain'
  if (code <= 77) return 'snow'
  if (code <= 82) return 'showers'
  if (code <= 86) return 'snow showers'
  return 'stormy'
}
