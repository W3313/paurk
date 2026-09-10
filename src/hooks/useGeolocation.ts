import { useCallback } from 'react'
import { actions, useStore } from '../store'

export function useGeolocation() {
  const status = useStore((s) => s.geoStatus)
  const pos = useStore((s) => s.userPos)
  const request = useCallback(() => {
    if (!('geolocation' in navigator)) { actions.setUserPos(null, 'unsupported'); return }
    actions.setUserPos(null, 'asking')
    navigator.geolocation.getCurrentPosition(
      (p) => actions.setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }, 'granted'),
      () => actions.setUserPos(null, 'denied'),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60000 },
    )
  }, [])
  return { status, pos, request }
}
