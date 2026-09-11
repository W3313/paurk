import { useCallback, useEffect, useRef, useState } from 'react'
import { actions } from '../store'

interface OrientationEventLike extends DeviceOrientationEvent { webkitCompassHeading?: number }
type RequestPermission = () => Promise<'granted' | 'denied'>

/** Compass heading (degrees) from device orientation, low-pass filtered; iOS needs a user gesture. */
export function useHeading() {
  const [supported, setSupported] = useState<boolean>(() => typeof window !== 'undefined' && 'DeviceOrientationEvent' in window)
  const [needsGesture, setNeedsGesture] = useState<boolean>(() => typeof (DeviceOrientationEvent as unknown as { requestPermission?: RequestPermission }).requestPermission === 'function')
  const [active, setActive] = useState(false)
  const filtered = useRef<number | null>(null)
  const raf = useRef(0)

  const start = useCallback(async () => {
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: RequestPermission }
    if (typeof DOE.requestPermission === 'function') {
      try { if ((await DOE.requestPermission()) !== 'granted') { setSupported(false); return } } catch { setSupported(false); return }
      setNeedsGesture(false)
    }
    setActive(true)
  }, [])

  useEffect(() => {
    if (!active) return
    const onEvent = (e: OrientationEventLike) => {
      let h: number | null = null
      if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading
      else if (e.absolute && e.alpha !== null) h = (360 - e.alpha) % 360
      if (h === null) return
      const prev = filtered.current
      if (prev === null) filtered.current = h
      else {
        let d = h - prev
        if (d > 180) d -= 360
        if (d < -180) d += 360
        filtered.current = (prev + d * 0.15 + 360) % 360
      }
      cancelAnimationFrame(raf.current)
      raf.current = requestAnimationFrame(() => actions.setHeading(filtered.current))
    }
    window.addEventListener('deviceorientationabsolute' as 'deviceorientation', onEvent)
    window.addEventListener('deviceorientation', onEvent)
    return () => {
      window.removeEventListener('deviceorientationabsolute' as 'deviceorientation', onEvent)
      window.removeEventListener('deviceorientation', onEvent)
      cancelAnimationFrame(raf.current)
      actions.setHeading(null)
    }
  }, [active])

  return { supported, needsGesture, active, start }
}
