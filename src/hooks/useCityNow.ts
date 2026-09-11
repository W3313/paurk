import { useMemo } from 'react'
import { useStore } from '../store'
import { useNow } from './useNow'
import { instantAtLocalMinutes, sunInfo, type SunInfo } from '../lib/time'
import type { LatLng } from '../types'

/** The displayed instant for a place (live clock or the sun-rule preview) and its sun info. */
export function useCityNow(pos: LatLng | null, timeZone: string): { now: Date; live: Date; sun: SunInfo | null; preview: boolean } {
  const live = useNow()
  const previewMinutes = useStore((s) => s.previewMinutes)
  return useMemo(() => {
    const now = previewMinutes === null ? live : instantAtLocalMinutes(live, timeZone, previewMinutes)
    return { now, live, sun: pos ? sunInfo(now, pos) : null, preview: previewMinutes !== null }
  }, [live, previewMinutes, timeZone, pos])
}
