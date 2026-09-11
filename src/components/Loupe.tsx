import { useMemo } from 'react'
import type { LatLng, Spot } from '../types'
import { layoutRadar } from '../lib/radar'
import { useStore } from '../store'

interface Props { origin: LatLng; spots: Spot[]; hotId: string | null }

/** Compass loupe: spots by bearing and √distance around you (spec §6.6). Decorative; rows carry the text. */
export function Loupe({ origin, spots, hotId }: Props) {
  const saved = useStore((s) => s.savedIds)
  const heading = useStore((s) => s.heading)
  const units = useStore((s) => s.units)
  const { points, rings, maxKm } = useMemo(() => layoutRadar(origin, spots), [origin, spots])
  const R = 88
  const label = (km: number) => (units === 'imperial' ? `${(km * 0.621).toFixed(km < 2 ? 1 : 0)} mi` : `${km} km`)
  return (
    <svg className="loupe" viewBox="0 0 200 200" aria-hidden="true" style={{ transform: `rotate(${-(heading ?? 0)}deg)` }}>
      {rings.map((km) => {
        const r = Math.sqrt(km / maxKm) * R
        return <g key={km}><circle className="ring" cx="100" cy="100" r={r} /><text x={100 + 3} y={100 - r - 2}>{label(km)}</text></g>
      })}
      <circle className="ring" cx="100" cy="100" r={R} />
      <text x="100" y="10" textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)', fontFamily: 'var(--font-body)' }}>N</text>
      <g className="you"><line x1="96" y1="100" x2="104" y2="100" /><line x1="100" y1="96" x2="100" y2="104" /></g>
      {points.map((p) => (
        <circle key={p.spot.id} className={`dot${p.spot.id === hotId ? ' is-hot' : ''}`} cx={100 + p.x * R} cy={100 + p.y * R} r={p.spot.id === hotId ? 3.5 : 2.5}
          style={{ fillOpacity: saved.includes(p.spot.id) || p.spot.id === hotId ? 1 : 0.55 }} />
      ))}
    </svg>
  )
}
