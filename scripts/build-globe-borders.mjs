// Precomputes the two line layers for the globe: country borders, and coastlines.
//
// topojson.mesh with a filter of a !== b returns only the arcs two countries share, so every border is
// one line rather than two stacked outlines; a === b returns the arcs belonging to a single polygon,
// which is every coastline and lake shore. They are separate files because they are wanted at different
// depths: borders come up early and cost 37 KB, coastlines only once the dot matrix has thinned past
// being able to describe a shore, and cost rather more.
//
// Output is the same shape as globe-dots.bin so it can share the loader: Int16 (lat*100, lng*100) pairs,
// delta-encoded, gzipped. Consecutive pairs form one segment, which is exactly what THREE.LineSegments
// wants and means no line-length table has to be stored. Interior vertices appear twice, as the end of
// one segment and the start of the next, and a repeat is a delta of zero, which compresses to nothing.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import * as topojson from 'topojson-client'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const RES = process.env.GLOBE_BORDERS_RES ?? '50m'
/**
 * The longest a segment may span before it is split. A straight line in lat/lng is a chord through the
 * sphere, so a long one sinks below the surface the dots sit on; the Sahara and the 49th parallel are
 * both drawn with very few vertices. A chord of theta radians dips about theta squared over eight, and
 * the lines sit 0.004 clear, so anything under 10 degrees is invisible — 3 is chosen with margin, and
 * measured to cost nothing: at 0.5 the same file is 166 KB gzipped, at 3 it is 164.
 */
const MAX_SEG_DEG = Number(process.env.GLOBE_BORDERS_STEP ?? 3)

const topo = JSON.parse(readFileSync(require.resolve(`world-atlas/countries-${RES}.json`), 'utf8'))
const KIND = process.env.GLOBE_LINES ?? 'borders'
const mesh = KIND === 'coast'
  ? topojson.mesh(topo, topo.objects.countries, (a, b) => a === b)
  : topojson.mesh(topo, topo.objects.countries, (a, b) => a !== b)

const out = []
let segments = 0
const push = (a, b) => { out.push(Math.round(a[1] * 100), Math.round(a[0] * 100), Math.round(b[1] * 100), Math.round(b[0] * 100)); segments++ }

for (const line of mesh.coordinates) {
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i]
    // Longitude wrapping: a border that crosses the antimeridian is drawn the short way round.
    let dLng = b[0] - a[0]
    if (dLng > 180) dLng -= 360
    if (dLng < -180) dLng += 360
    const span = Math.max(Math.abs(b[1] - a[1]), Math.abs(dLng))
    const steps = Math.max(1, Math.ceil(span / MAX_SEG_DEG))
    let prev = a
    for (let s = 1; s <= steps; s++) {
      const t = s / steps
      const next = [a[0] + dLng * t, a[1] + (b[1] - a[1]) * t]
      push(prev, next)
      prev = next
    }
  }
}

let prevLat = 0, prevLng = 0
for (let i = 0; i < out.length; i += 2) {
  const lat = out[i], lng = out[i + 1]
  out[i] = lat - prevLat
  out[i + 1] = lng - prevLng
  prevLat = lat; prevLng = lng
}
const buf = new Int16Array(out)
mkdirSync(resolve(root, 'public'), { recursive: true })
const bytes = Buffer.from(buf.buffer)
const name = KIND === 'coast' ? 'globe-coast' : 'globe-borders'
writeFileSync(resolve(root, `public/${name}.bin`), bytes)
const gz = gzipSync(bytes, { level: 9 })
writeFileSync(resolve(root, `public/${name}.bin.gz`), gz)
console.log(`${name} ${RES}: ${segments} segments, ${bytes.length} bytes raw, ${gz.length} bytes gzipped`)
