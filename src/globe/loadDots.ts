/**
 * Loads the land dots for the globe.
 *
 * The file is delta-encoded (scripts/build-globe-dots.mjs) and shipped gzipped, which takes it from
 * 92 KB to 12.5 KB. Hosts differ in how they serve a `.gz`: some set `Content-Encoding: gzip` and the
 * browser inflates it for us, others hand over the compressed bytes as-is. Rather than guess, we sniff
 * the gzip magic number and inflate only when the bytes are still compressed.
 */
export const GZIP_MAGIC = [0x1f, 0x8b] as const

export function isGzipped(buf: ArrayBuffer): boolean {
  const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength))
  return head.length === 2 && head[0] === GZIP_MAGIC[0] && head[1] === GZIP_MAGIC[1]
}

/** Undoes the delta encoding in place and returns absolute (lat*100, lng*100) pairs. */
export function undelta(data: Int16Array): Int16Array {
  for (let i = 2; i < data.length; i += 2) {
    data[i] += data[i - 2]
    data[i + 1] += data[i - 1]
  }
  return data
}

export async function inflate(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).arrayBuffer()
}

export async function decodeDots(buf: ArrayBuffer): Promise<Int16Array> {
  const plain = isGzipped(buf) ? await inflate(buf) : buf
  return undelta(new Int16Array(plain))
}

export async function loadDots(baseUrl: string): Promise<Int16Array> {
  const canInflate = typeof DecompressionStream === 'function'
  if (canInflate) {
    try {
      const res = await fetch(`${baseUrl}.gz`)
      if (res.ok) return await decodeDots(await res.arrayBuffer())
    } catch {
      /* fall through to the uncompressed file */
    }
  }
  const res = await fetch(baseUrl)
  if (!res.ok) throw new Error(`globe dots: ${res.status}`)
  return decodeDots(await res.arrayBuffer())
}
