import { useEffect, useRef, useState } from 'react'
import { geoOrthographic, geoPath } from 'd3-geo'
import type { GlobeMarker } from '../globe/GlobeEngine'
import { getState } from '../store'
import { loadDots } from '../globe/loadDots'

interface Props { markers: GlobeMarker[]; dotsUrl: string; onSelect: (id: string) => void; selected: string | null }

/** No-WebGL fallback (spec §4.10): the same dots drawn once with d3-geo, cities as words. */
export function Globe2D({ markers, dotsUrl, onSelect, selected }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [rot, setRot] = useState<[number, number]>([-20, -20])
  const [dots, setDots] = useState<[number, number][]>([])
  const [size, setSize] = useState(300)
  useEffect(() => {
    loadDots(dotsUrl).then((a) => {
      const out: [number, number][] = []
      for (let i = 0; i < a.length / 2; i += 3) out.push([a[i * 2 + 1] / 100, a[i * 2] / 100])
      setDots(out)
    }).catch(() => {})
  }, [dotsUrl])
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const s = Math.min(c.parentElement?.clientWidth ?? 300, c.parentElement?.clientHeight ?? 300)
    setSize(s)
  }, [])
  useEffect(() => {
    const c = canvas.current
    if (!c || !size) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = size * dpr; c.height = size * dpr
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    const css = getComputedStyle(document.documentElement)
    const proj = geoOrthographic().translate([size / 2, size / 2]).scale(size / 2 - 4).rotate(rot).clipAngle(90)
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = css.getPropertyValue('--globe-ocean')
    ctx.beginPath(); geoPath(proj, ctx)({ type: 'Sphere' }); ctx.fill()
    ctx.fillStyle = css.getPropertyValue('--globe-land')
    ctx.globalAlpha = 0.5
    for (const d of dots) { const p = proj(d); if (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 1.2, 0, Math.PI * 2); ctx.fill() } }
    ctx.globalAlpha = 1
  }, [dots, rot, size])
  const css = typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement) : null
  const proj = geoOrthographic().translate([size / 2, size / 2]).scale(size / 2 - 4).rotate(rot).clipAngle(90)
  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }} tabIndex={0} role="application" aria-label="World globe (simple). Arrow keys turn it."
      onKeyDown={(e) => { const k = 8; if (e.key === 'ArrowLeft') setRot(([a, b]) => [a - k, b]); else if (e.key === 'ArrowRight') setRot(([a, b]) => [a + k, b]); else if (e.key === 'ArrowUp') setRot(([a, b]) => [a, b + k]); else if (e.key === 'ArrowDown') setRot(([a, b]) => [a, b - k]); else return; e.preventDefault() }}>
      <canvas ref={canvas} style={{ width: size, height: size, display: 'block' }} aria-hidden="true" />
      {markers.filter((m) => m.kind === 'city').map((m) => {
        const p = proj([m.lng, m.lat])
        if (!p) return null
        return <button key={m.id} type="button" className={`word word--small${m.id === selected ? ' is-on' : ''}`} style={{ position: 'absolute', left: p[0], top: p[1], transform: 'translate(-50%,-50%)', color: css?.getPropertyValue('--ink') }} onClick={() => onSelect(m.id)}>{getState().mode === 'sky' || m.id === selected ? m.label : '·'}</button>
      })}
    </div>
  )
}
