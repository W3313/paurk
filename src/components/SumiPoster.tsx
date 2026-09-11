import type { ReactNode } from 'react'
import type { BestTime, Category, Spot } from '../types'

interface Props { spot: Spot; cityName: string; className?: string; compact?: boolean }

/** FNV-1a 32-bit hash of a string. */
export function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: a tiny seeded PRNG yielding floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rng = () => number
type Form = 'water' | 'ridge' | 'canopy' | 'window' | 'squares' | 'none'

const LIGHT: Record<BestTime, string> = {
  'golden-hour': '#E8B98A', morning: '#D6AAA0', night: '#343842', afternoon: '#D6CEC0',
}
const SEAL: Record<BestTime, [number, number]> = {
  morning: [70, 170], 'golden-hour': [330, 165], afternoon: [300, 70], night: [300, 70],
}
const FORM: Record<Category, Form> = {
  waterfront: 'water', beach: 'water',
  viewpoint: 'ridge', rooftop: 'ridge', trail: 'ridge',
  park: 'canopy', garden: 'canopy',
  cafe: 'window', library: 'window', bookstore: 'window', indoor: 'window', museum: 'window',
  plaza: 'squares', market: 'squares',
  other: 'none',
}
const GRAPHITE = 'var(--globe-land, #6B685F)'

const r1 = (n: number) => Math.round(n * 10) / 10
const between = (rng: Rng, lo: number, hi: number) => r1(lo + rng() * (hi - lo))
const count = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1))

/** The single category form, in graphite. `hy` is the horizon's mean height. */
function form(kind: Form, rng: Rng, hy: number, alpha: number, blurId: string, winId: string): ReactNode {
  switch (kind) {
    case 'water': {
      const n = count(rng, 3, 5)
      return Array.from({ length: n }, (_, i) => {
        const inset = between(rng, 0, 40)
        return (
          <rect key={i} x={inset} y={between(rng, hy + 14 + i * 16, hy + 18 + i * 16)}
            width={r1(400 - inset - between(rng, 0, 40))} height={between(rng, 3, 7)}
            fill={GRAPHITE} opacity={alpha} filter={`url(#${blurId})`} />
        )
      })
    }
    case 'ridge': {
      const peaks = count(rng, 4, 6)
      const pts = [`0,${hy}`]
      for (let i = 1; i <= peaks; i++) pts.push(`${r1((400 * i) / (peaks + 1))},${between(rng, hy - 30, hy - 8)}`)
      pts.push(`400,${hy}`)
      return <polygon points={pts.join(' ')} fill={GRAPHITE} opacity={alpha} />
    }
    case 'canopy': {
      const n = count(rng, 1, 2)
      return Array.from({ length: n }, (_, i) => {
        const r = between(rng, 18, 36)
        return (
          <circle key={i} cx={between(rng, 60, 340)} cy={r1(hy - r * 0.7 - between(rng, 0, 10))} r={r}
            fill={GRAPHITE} opacity={alpha} filter={`url(#${blurId})`} />
        )
      })
    }
    case 'window': {
      const w = between(rng, 44, 60)
      const ht = between(rng, 96, 126)
      return <rect x={between(rng, 130, 270)} y={r1(hy - ht * 0.75)} width={w} height={ht} fill={`url(#${winId})`} opacity={alpha} />
    }
    case 'squares': {
      const n = count(rng, 5, 8)
      const size = between(rng, 7, 11)
      const gap = between(rng, 10, 18)
      const x0 = r1((400 - (n * size + (n - 1) * gap)) / 2 + between(rng, -20, 20))
      const y = between(rng, hy + 10, hy + 16)
      return Array.from({ length: n }, (_, i) => (
        <rect key={i} x={r1(x0 + i * (size + gap))} y={r1(y + between(rng, -1, 1))} width={size} height={size}
          fill={GRAPHITE} opacity={alpha} />
      ))
    }
    default:
      return null
  }
}

/**
 * Sumi poster: a deterministic ink-wash placeholder painted from the spot's id.
 * Paper, a horizon light for its first bestTime, one wobbling horizon line, one category form in
 * graphite, the seal, grain and a mono caption. `compact` drops grain and caption for thumbnails.
 */
export function SumiPoster({ spot, cityName, className, compact = false }: Props) {
  const h = hash(spot.id)
  const rng = mulberry32(h)
  const uid = h.toString(36)
  const lightId = `sumi-light-${uid}`
  const winId = `sumi-win-${uid}`
  const washId = `sumi-wash-${uid}`
  const blurId = `sumi-blur-${uid}`
  const grainId = `sumi-grain-${uid}`

  const time: BestTime = spot.bestTimes[0] ?? 'afternoon'
  const light = LIGHT[time]

  // Horizon: 6–9 anchors on a base line at 154–186, each jittered ±4, smoothed through midpoints.
  const n = count(rng, 6, 9)
  const hy = between(rng, 154, 186)
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) pts.push([r1((400 * i) / (n - 1)), between(rng, hy - 4, hy + 4)])
  let d = `M${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < n - 1; i++) {
    const [x, y] = pts[i]
    const [nx, ny] = pts[i + 1]
    d += ` Q${x} ${y} ${r1((x + nx) / 2)} ${r1((y + ny) / 2)}`
  }
  d += ` L${pts[n - 1][0]} ${pts[n - 1][1]}`

  const alpha = Math.round((0.18 + rng() * 0.1) * 100) / 100 // graphite opacity .18–.28
  const shape = form(FORM[spot.category] ?? 'none', rng, hy, alpha, blurId, winId)

  const [sx, sy] = SEAL[time]
  const stars = time === 'night'
    ? Array.from({ length: 3 }, () => [between(rng, 20, 380), between(rng, 16, 136)] as const)
    : []

  return (
    <svg role="img" aria-label={`Poster for ${spot.name}`} viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className={className}>
      <defs>
        <linearGradient id={lightId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} stopOpacity={0} />
          <stop offset="0.45" stopColor={light} stopOpacity={0.9} />
          <stop offset="1" stopColor={light} stopOpacity={0.55} />
        </linearGradient>
        <linearGradient id={winId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GRAPHITE} stopOpacity={0.3} />
          <stop offset="1" stopColor={GRAPHITE} stopOpacity={1} />
        </linearGradient>
        <filter id={washId} filterUnits="userSpaceOnUse" x={0} y={0} width={400} height={300}>
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.04" numOctaves={2} seed={h % 997} result="t" />
          <feDisplacementMap in="SourceGraphic" in2="t" scale={6} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={blurId} filterUnits="userSpaceOnUse" x={0} y={0} width={400} height={300}>
          <feGaussianBlur stdDeviation={2} />
        </filter>
        {!compact && (
          <filter id={grainId}>
            <feTurbulence type="fractalNoise" baseFrequency={0.8} numOctaves={1} seed={h % 991} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        )}
      </defs>

      <rect width={400} height={300} fill="var(--bg)" />
      <rect x={0} y={120} width={400} height={180} fill={`url(#${lightId})`} opacity={0.5} style={{ mixBlendMode: 'multiply' }} />
      {shape}
      <path d={d} fill="none" stroke="var(--ink)" strokeOpacity={0.55} strokeWidth={1.2} strokeLinecap="round" filter={`url(#${washId})`} />

      {time === 'night'
        ? <circle cx={sx} cy={sy} r={9} fill="none" stroke="var(--accent)" strokeWidth={1.2} />
        : <circle cx={sx} cy={sy} r={9} fill="var(--accent)" />}
      {stars.map(([x, y], i) => <rect key={i} x={x} y={y} width={1} height={1} fill="var(--ink)" />)}

      {!compact && <rect width={400} height={300} filter={`url(#${grainId})`} opacity={0.06} />}
      {!compact && (
        <g fontFamily="var(--font-mono)" fontSize={11} letterSpacing=".02em" fill="var(--ink-2)">
          <text x={12} y={288}>{cityName.toLowerCase()}</text>
          <text x={388} y={288} textAnchor="end">{spot.category}</text>
        </g>
      )}
    </svg>
  )
}
