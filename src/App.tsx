import { useMemo, useState } from 'react'
import { GlobeView } from './components/GlobeView'
import type { GlobeMarker, GlobeTheme } from './globe/GlobeEngine'
import { cities } from './data'

const theme: GlobeTheme = {
  oceanDay: '#101826', oceanNight: '#070a10', rim: '#3a4a6a',
  dotDay: '#c9d3e6', dotNight: '#e9c46a', atmosphere: '#7aa2ff',
  marker: '#e9c46a', markerActive: '#ffffff', user: '#7ee0c3',
}

export default function App() {
  const [selected, setSelected] = useState<string | null>(null)
  const markers = useMemo<GlobeMarker[]>(() => cities.map((c) => ({ id: c.slug, lat: c.lat, lng: c.lng, label: c.name, kind: 'city', weight: c.spotCount })), [])
  const fly = useMemo(() => {
    const c = cities.find((x) => x.slug === selected)
    return c ? { lat: c.lat, lng: c.lng, zoom: 1.6, key: c.slug } : null
  }, [selected])
  return (
    <div className="tc-app">
      <GlobeView markers={markers} theme={theme} selectedId={selected} flyTarget={fly} onSelect={setSelected} />
      <div className="tc-debug">{selected ?? 'TrueChiller (scaffold)'} · {cities.length} cities</div>
    </div>
  )
}
