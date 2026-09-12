import { useEffect, useRef, useState } from 'react'
import type { GlobeEngine, GlobeMarker, GlobeTheme } from '../globe/GlobeEngine'
import { setGlobe } from '../globe/handle'
import { Globe2D } from './Globe2D'
import { actions } from '../store'

interface Props {
  markers: GlobeMarker[]
  selectedId: string | null
  seat: [number, number]
  /** Fraction of the shorter viewport side the sphere spans. */
  fit: number
  still: boolean
  sunDate: Date | null
  pushBack: number
  paused: boolean
  autoRotate: boolean
  themeKey: string
  onSelect: (id: string | null) => void
  onHover?: (id: string | null) => void
}

export const dotsUrl = `${import.meta.env.BASE_URL}globe-dots.bin`

export function readGlobeTheme(): GlobeTheme {
  const css = getComputedStyle(document.documentElement)
  const v = (n: string) => css.getPropertyValue(n).trim()
  return { ocean: v('--globe-ocean'), night: v('--globe-night'), land: v('--globe-land'), ink: v('--ink'), accent: v('--accent'), accentInk: v('--accent-ink'), halo: v('--globe-land') }
}

/** Mounts the three.js engine lazily (after first paint) and keeps it in sync with the app. */
export function GlobeView({ markers, selectedId, seat, fit, still, sunDate, pushBack, paused, autoRotate, themeKey, onSelect, onHover }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const labels = useRef<HTMLDivElement>(null)
  const engine = useRef<GlobeEngine | null>(null)
  const [fallback, setFallback] = useState(false)
  const [ready, setReady] = useState(false)
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect
  const onHoverRef = useRef(onHover); onHoverRef.current = onHover

  useEffect(() => {
    let disposed = false
    let g: GlobeEngine | null = null
    const start = async () => {
      try {
        if (!window.WebGLRenderingContext) throw new Error('no webgl')
        const { GlobeEngine } = await import('../globe/GlobeEngine')
        if (disposed || !host.current || !labels.current) return
        g = new GlobeEngine({
          container: host.current, labelLayer: labels.current, dotsUrl, theme: readGlobeTheme(), still,
          coarse: matchMedia('(pointer: coarse)').matches,
          onSelect: (id) => onSelectRef.current(id),
          onHover: (id) => onHoverRef.current?.(id),
          onReady: () => { setReady(true); actions.globeReady() },
        })
        engine.current = g
        setGlobe(g)
      } catch (e) {
        console.warn('globe: falling back to 2D', e)
        setFallback(true)
        actions.globeReady()
      }
    }
    const id = window.setTimeout(start, 0)
    return () => { disposed = true; window.clearTimeout(id); g?.dispose(); engine.current = null; setGlobe(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { engine.current?.setMarkers(markers) }, [markers, ready])
  useEffect(() => { engine.current?.setTheme(readGlobeTheme()) }, [themeKey, ready])
  useEffect(() => { engine.current?.setSeat(seat[0], seat[1]) }, [seat, ready])
  useEffect(() => { engine.current?.setFit(fit) }, [fit, ready])
  useEffect(() => { engine.current?.setStill(still) }, [still, ready])
  useEffect(() => { engine.current?.setSunDate(sunDate) }, [sunDate, ready])
  useEffect(() => { engine.current?.setPushBack(pushBack) }, [pushBack, ready])
  useEffect(() => { engine.current?.setPaused(paused) }, [paused, ready])
  useEffect(() => { if (engine.current) engine.current.autoRotate = autoRotate }, [autoRotate, ready])

  if (fallback) return <Globe2D markers={markers} dotsUrl={dotsUrl} onSelect={(id) => onSelect(id)} selected={selectedId} />
  return (
    <div className={`globe-wrap${ready && !still ? ' is-breathing-in' : ''}`} ref={host}>
      <div className="paurk-globe-labels" ref={labels} aria-hidden="true" />
    </div>
  )
}
