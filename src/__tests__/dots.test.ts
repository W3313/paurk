import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { decodeDots, isGzipped, undelta } from '../globe/loadDots'

/** Encodes absolute pairs the way scripts/build-globe-dots.mjs does. */
function encode(pairs: [number, number][]): Int16Array {
  const out: number[] = []
  let pl = 0, pn = 0
  for (const [lat, lng] of pairs) { out.push(lat - pl, lng - pn); pl = lat; pn = lng }
  return new Int16Array(out)
}

const pairs: [number, number][] = [[5150, -12], [5151, 300], [-3390, 15100], [3568, 13969], [0, -17999]]

describe('globe dot encoding', () => {
  it('round-trips through delta encoding, including large longitude jumps', () => {
    const back = undelta(encode(pairs).slice())
    expect([...back]).toEqual(pairs.flat())
  })
  it('recognises gzipped bytes and inflates only those', async () => {
    const raw = encode(pairs)
    const plain = raw.buffer.slice(0) as ArrayBuffer
    const gz = gzipSync(Buffer.from(raw.buffer))
    const gzBuf = gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength) as ArrayBuffer
    expect(isGzipped(plain)).toBe(false)
    expect(isGzipped(gzBuf)).toBe(true)
    // Either form must decode to the same absolute coordinates, so it does not matter whether the
    // host set Content-Encoding and the browser already inflated the body.
    expect([...(await decodeDots(plain))]).toEqual(pairs.flat())
    expect([...(await decodeDots(gzBuf))]).toEqual(pairs.flat())
  })
  it('decodes the real shipped file to plausible coordinates', async () => {
    const { readFileSync } = await import('node:fs')
    const f = readFileSync(new URL('../../public/globe-dots.bin.gz', import.meta.url))
    const data = await decodeDots(f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength) as ArrayBuffer)
    expect(data.length).toBeGreaterThan(20000)
    for (let i = 0; i < data.length; i += 2) {
      expect(Math.abs(data[i] / 100)).toBeLessThanOrEqual(90)
      expect(Math.abs(data[i + 1] / 100)).toBeLessThanOrEqual(180.01)
    }
  })
})

/**
 * The two shipped lattices, checked for the property a previous attempt at level-of-detail got wrong.
 *
 * That attempt drew a prefix of one dense file, on the reasoning that a Fibonacci sphere's points are
 * evenly spread so any prefix of them must be too. They are not: the i-th point sits at z = 1 - 2i/N,
 * so the array runs from pole to pole and a prefix is a polar cap. The globe shipped with everything
 * below latitude 60 missing. Reordering the buffer into a stride subsample renders the whole world but
 * not evenly — striding multiplies the golden angle, and golden is the whole point — so each level of
 * detail has to be its own lattice. These two tests are that bug, written down: one that the dots reach
 * both hemispheres, and one that they are evenly spaced when they get there.
 */
describe('the shipped lattices', () => {
  const read = (name: string) => {
    const buf = readFileSync(new URL(`../../public/${name}`, import.meta.url))
    const d = undelta(new Int16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)))
    const pts: [number, number][] = []
    for (let i = 0; i < d.length; i += 2) pts.push([d[i] / 100, d[i + 1] / 100])
    return pts
  }
  const lattices = [['globe-dots.bin', 23015], ['globe-dots-fine.bin', 207013]] as const

  it.each(lattices)('%s covers the whole globe, not a cap', (name, count) => {
    const pts = read(name)
    expect(pts).toHaveLength(count)
    const lat = pts.map((p) => p[0])
    // Reduced, not spread: 207,013 arguments overflow the call stack.
    const lo = lat.reduce((a, b) => Math.min(a, b), Infinity)
    const hi = lat.reduce((a, b) => Math.max(a, b), -Infinity)
    // Land reaches both poles: Antarctica below -60, Greenland and Siberia above 60.
    expect(lo).toBeLessThan(-60)
    expect(hi).toBeGreaterThan(60)
    // And it is spread through the middle rather than bunched at one end.
    const below = lat.filter((l) => l < 0).length / lat.length
    expect(below).toBeGreaterThan(0.15)
    expect(below).toBeLessThan(0.5)
  })

  it.each(lattices)('%s is evenly spaced', (name) => {
    const pts = read(name)
    const rad = (d: number) => (d * Math.PI) / 180
    const vec = ([la, ln]: [number, number]) =>
      [Math.cos(rad(la)) * Math.cos(rad(ln)), Math.sin(rad(la)), Math.cos(rad(la)) * Math.sin(rad(ln))] as const
    // Nearest-neighbour distance for a sample of points, over a lat/lng bucket grid.
    const G = Math.max(8, Math.round(Math.sqrt(pts.length / 2)))
    const cells = new Map<number, number[]>()
    const cell = ([la, ln]: [number, number]) =>
      Math.min(G - 1, Math.floor(((la + 90) / 180) * G)) * 4096 + Math.min(2 * G - 1, Math.floor(((ln + 180) / 360) * 2 * G))
    pts.forEach((p, i) => { const k = cell(p); if (!cells.has(k)) cells.set(k, []); cells.get(k)!.push(i) })
    const ds: number[] = []
    for (let i = 0; i < pts.length; i += Math.max(1, Math.floor(pts.length / 1500))) {
      const v = vec(pts[i]), c0 = cell(pts[i])
      let best = Infinity
      for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
        for (const m of cells.get(c0 + di * 4096 + dj) ?? []) {
          if (m === i) continue
          const w = vec(pts[m])
          best = Math.min(best, Math.acos(Math.max(-1, Math.min(1, v[0] * w[0] + v[1] * w[1] + v[2] * w[2]))))
        }
      }
      if (best < Infinity) ds.push(best)
    }
    const mean = ds.reduce((s, x) => s + x, 0) / ds.length
    const cv = Math.sqrt(ds.reduce((s, x) => s + (x - mean) ** 2, 0) / ds.length) / mean
    // A proper lattice measures about 0.13-0.15 here; every stride subsample of one measures 0.46+.
    expect(cv).toBeLessThan(0.25)
  })
})
