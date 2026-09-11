// Precomputes the dot-matrix land layer for the globe.
// Samples a Fibonacci sphere, keeps the points that fall on land (world-atlas 50m),
// and writes them as Int16 (lat*100, lng*100) pairs to public/globe-dots.bin.
// A per-polygon bounding-box index keeps the point-in-polygon test fast.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as topojson from 'topojson-client'
import { geoContains, geoBounds } from 'd3-geo'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const N = Number(process.env.GLOBE_DOTS ?? 80000) // tuned for the dot density in docs/DESIGN.md §4.2
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/land-50m.json'), 'utf8'))
const landFc = topojson.feature(topo, topo.objects.land)
const land = landFc.type === "FeatureCollection" ? landFc.features[0] : landFc

// Split the MultiPolygon into individual polygons with bounding boxes.
const polys = land.geometry.coordinates.map((coords) => {
  const f = { type: 'Feature', geometry: { type: 'Polygon', coordinates: coords } }
  const [[w, s], [e, n]] = geoBounds(f)
  return { f, w, s, e, n, wraps: w > e }
})

function onLand(lng, lat) {
  for (const p of polys) {
    if (lat < p.s || lat > p.n) continue
    if (p.wraps ? lng < p.w && lng > p.e : lng < p.w || lng > p.e) continue
    if (geoContains(p.f, [lng, lat])) return true
  }
  return false
}

const out = []
const golden = Math.PI * (3 - Math.sqrt(5))
for (let i = 0; i < N; i++) {
  const y = 1 - (i / (N - 1)) * 2 // 1 .. -1
  const r = Math.sqrt(1 - y * y)
  const theta = golden * i
  const x = Math.cos(theta) * r
  const z = Math.sin(theta) * r
  const lat = (Math.asin(y) * 180) / Math.PI
  const lng = (Math.atan2(z, x) * 180) / Math.PI
  if (onLand(lng, lat)) out.push(Math.round(lat * 100), Math.round(lng * 100))
}
// Delta-encode: neighbouring Fibonacci-sphere points are close, so successive differences are small
// and highly compressible, where the absolute coordinates are near-random int16 noise.
// Int16Array's modular store makes this exactly reversible even when a delta exceeds the range.
let prevLat = 0, prevLng = 0
for (let i = 0; i < out.length; i += 2) {
  const lat = out[i], lng = out[i + 1]
  out[i] = lat - prevLat
  out[i + 1] = lng - prevLng
  prevLat = lat; prevLng = lng
}
const buf = new Int16Array(out)
mkdirSync(resolve(root, 'public'), { recursive: true })
writeFileSync(resolve(root, 'public/globe-dots.bin'), Buffer.from(buf.buffer))
// Ship a gzipped copy too: Cloudflare does not compress application/octet-stream, and the browser
// can inflate this itself with DecompressionStream. The plain file stays as the fallback.
const { gzipSync } = await import('node:zlib')
const gz = gzipSync(Buffer.from(buf.buffer), { level: 9 })
writeFileSync(resolve(root, 'public/globe-dots.bin.gz'), gz)
console.log(`globe dots: sampled ${N}, kept ${out.length / 2} land points -> public/globe-dots.bin (${buf.byteLength} B) + .gz (${gz.length} B)`)
