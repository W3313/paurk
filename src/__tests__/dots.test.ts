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
