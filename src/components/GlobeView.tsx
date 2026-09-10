import { useEffect, useRef } from 'react'
import { GlobeEngine, type GlobeMarker, type GlobeTheme } from '../globe/GlobeEngine'

interface Props {
  markers: GlobeMarker[]
  theme: GlobeTheme
  selectedId: string | null
  flyTarget: { lat: number; lng: number; zoom: number; key: string } | null
  onSelect: (id: string | null) => void
  onReady?: () => void
  autoRotate?: boolean
  sunDate?: Date | null
}

const dotsUrl = `${import.meta.env.BASE_URL}globe-dots.bin`

export function GlobeView({ markers, theme, selectedId, flyTarget, onSelect, onReady, autoRotate = true, sunDate = null }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const labels = useRef<HTMLDivElement>(null)
  const engine = useRef<GlobeEngine | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useEffect(() => {
    if (!host.current || !labels.current) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const g = new GlobeEngine({
      container: host.current,
      labelLayer: labels.current,
      dotsUrl,
      theme,
      reducedMotion: reduced,
      onSelect: (id) => onSelectRef.current(id),
      onReady: () => onReadyRef.current?.(),
    })
    engine.current = g
    return () => { g.dispose(); engine.current = null }
    // theme handled by setTheme below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { engine.current?.setMarkers(markers) }, [markers])
  useEffect(() => { engine.current?.setTheme(theme) }, [theme])
  useEffect(() => { engine.current?.select(selectedId, false) }, [selectedId, markers])
  useEffect(() => { if (engine.current) engine.current.autoRotate = autoRotate }, [autoRotate])
  useEffect(() => { engine.current?.setSunDate(sunDate) }, [sunDate])
  useEffect(() => {
    if (flyTarget && engine.current) void engine.current.flyTo(flyTarget.lat, flyTarget.lng, flyTarget.zoom)
  }, [flyTarget])

  return (
    <div className="tc-globe" ref={host}>
      <div className="tc-globe-labels" ref={labels} aria-hidden="true" />
    </div>
  )
}
