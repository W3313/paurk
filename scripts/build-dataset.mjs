// Merges the reviewed per-city research files (data/research/*.json) into the
// app dataset at src/data/spots.json, validating and de-duplicating on the way,
// and writes a human-readable report to data/research-report.md.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const IN = resolve(root, 'data/research')
const OUT = resolve(root, 'src/data/spots.json')
const OUT_DETAILS = resolve(root, 'src/data/spot-details.json')
const REPORT = resolve(root, 'data/research-report.md')

const CATEGORIES = new Set(['park','garden','waterfront','viewpoint','beach','trail','plaza','rooftop','cafe','library','bookstore','museum','indoor','market','other'])
const VIBES = new Set(['quiet','sunset','sunrise','night','view','water','green','cozy','rain-ok','solo','group','free','people-watch','study','stargaze','picnic','walk','skyline','hidden'])
const TIMES = new Set(['morning','afternoon','golden-hour','night'])
const MAX_KM_FROM_CENTRE = 80

const R = 6371
function km(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const str = (v, max = 600) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '')
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
/** Like `str`, but never cuts a word in half: link labels are rendered verbatim as the link text. */
const clipWords = (v, max) => {
  const t = str(v, 10000)
  return t.length <= max ? t : t.slice(0, max - 1).replace(/\s+\S*$/, '').trimEnd() + '…'
}
/**
 * Code and data files in repositories are not provenance for a place: they are other people's seed
 * data and notes. Travel writing that happens to live in a repository is kept.
 */
const isCodeArtifact = (u) =>
  /(^|\.)(github|gitlab)\.com$/.test(u.hostname) &&
  (/\.(ts|tsx|js|mjs|cjs|py|csv|json|ya?ml|sql)$/i.test(u.pathname) ||
    /\/seed|\/knowledge[-_ ]?base\/|\/skills\/|[-_]kb\/|_research\.md$/i.test(u.pathname))

const files = readdirSync(IN).filter((f) => f.endsWith('.json')).sort()
const cities = []
const spots = []
/** Prose only ever shown on a spot page; kept out of the entry bundle (see src/data/index.ts). */
const details = {}
const report = []
let dropped = 0

for (const file of files) {
  let city
  try { city = JSON.parse(readFileSync(resolve(IN, file), 'utf8')) } catch (e) { report.push(`- **${file}**: invalid JSON (${e.message}) — skipped`); continue }
  const slug = str(city.slug) || file.replace(/\.json$/, '')
  const cLat = num(city.cityLat), cLng = num(city.cityLng)
  if (cLat === null || cLng === null || !str(city.city)) { report.push(`- **${file}**: missing city centre/name — skipped`); continue }
  const seen = new Set()
  const cityDropped = []
  let kept = 0, cautions = 0, wiki = 0, reddit = 0
  for (const raw of city.spots ?? []) {
    const name = str(raw.name, 120)
    const key = slugify(name)
    if (!name || seen.has(key)) { cityDropped.push(`${name || '(unnamed)'}: ${!name ? 'no name' : 'duplicate'}`); dropped++; continue }
    const lat = num(raw.lat), lng = num(raw.lng)
    if (lat === null || lng === null) { cityDropped.push(`${name}: missing coordinates`); dropped++; continue }
    const dist = km(cLat, cLng, lat, lng)
    if (dist > MAX_KM_FROM_CENTRE) { cityDropped.push(`${name}: ${dist.toFixed(0)} km from city centre`); dropped++; continue }
    if (raw.reviewed === false && /\b(abandon|derelict|trespass|no trespassing|climb the fence|hop the fence|active rail|freight line|squat)/i.test(`${raw.blurb} ${raw.tips} ${raw.safety?.note}`)) { cityDropped.push(`${name}: not reviewed and safety keywords present`); dropped++; continue }
    const category = CATEGORIES.has(raw.category) ? raw.category : 'other'
    const vibes = [...new Set((raw.vibes ?? []).filter((v) => VIBES.has(v)))]
    const bestTimes = [...new Set((raw.bestTimes ?? []).filter((v) => TIMES.has(v)))]
    if (raw.free === true && !vibes.includes('free')) vibes.push('free')
    if (raw.indoor === true && !vibes.includes('rain-ok')) vibes.push('rain-ok')
    const sources = (raw.sources ?? [])
      .filter((s) => s && typeof s.url === 'string' && s.url.length < 500 && !/[\s\x00-\x1f]/.test(s.url.trim()))
      .map((s) => { try { const u = new URL(s.url.trim()); return u.protocol === 'https:' || u.protocol === 'http:' ? { ...s, url: u.href, host: u.hostname } : null } catch { return null } })
      .filter(Boolean)
      .filter((s) => { try { return !isCodeArtifact(new URL(s.url)) } catch { return false } })
      .slice(0, 4)
      .map((s) => ({ url: s.url, label: clipWords(s.label, 90) || s.host, kind: ['reddit','forum','blog','press','official','other'].includes(s.kind) ? s.kind : 'other' }))
    if (sources.some((s) => s.kind === 'reddit' || /reddit\.com/.test(s.url))) reddit++
    const note = (raw.safety?.note ?? '').trim().replace(/\s+/g, ' ')
    if (note.length > 400) throw new Error(`${slug}/${key}: safety note is ${note.length} chars; raise the cap rather than truncating the mitigation away`)
    const level = raw.safety?.level === 'caution' ? 'caution' : 'ok'
    if (level === 'caution') cautions++
    const wikipediaTitle = typeof raw.wikipediaTitle === 'string' && raw.wikipediaTitle.trim() ? raw.wikipediaTitle.trim().replace(/_/g, ' ') : null
    if (wikipediaTitle) wiki++
    seen.add(key)
    kept++
    details[`${slug}/${key}`] = { blurb: str(raw.blurb, 700), tips: str(raw.tips, 400), sources }
    spots.push({
      id: `${slug}/${key}`,
      city: slug,
      name,
      neighborhood: str(raw.neighborhood, 80),
      category,
      vibes,
      bestTimes: bestTimes.length ? bestTimes : ['afternoon'],
      indoor: raw.indoor === true,
      free: raw.free === true,
      hours: str(raw.hours, 160) || 'varies',
      lat: +lat.toFixed(5),
      lng: +lng.toFixed(5),
      coordConfidence: ['high','medium','low'].includes(raw.coordConfidence) ? raw.coordConfidence : 'low',
      wikipediaTitle,
      sourceCount: sources.length,
      safety: { level, note: str(raw.safety?.note, 400) },
      lowkeyScore: Math.min(5, Math.max(1, Math.round(num(raw.lowkeyScore) ?? 3))),
      // "reviewed" means a verify agent read this entry and did not drop it. It is NOT a claim that
      // anything was checked against a source — 354 of 604 spots cite none. It was called "verified"
      // until that was pointed out; the name was doing work the flag could not support.
      reviewed: raw.reviewed !== false,
    })
  }
  const unreviewed = (city.spots ?? []).filter((s) => s.reviewed === false).length
  cities.push({ slug, name: str(city.city, 60), country: str(city.country, 60), region: str(city.region, 30) || 'other', lat: +cLat.toFixed(4), lng: +cLng.toFixed(4), timezone: str(city.timezone, 40) || 'UTC', spotCount: kept, reviewed: unreviewed === 0 })
  report.push(`- **${city.city}** (${slug}): ${kept} spots kept${unreviewed ? ` (${unreviewed} not independently reviewed)` : ''}, ${cautions} caution, ${wiki} with Wikipedia photo title, ${reddit} with reddit-sourced link${cityDropped.length ? `; dropped: ${cityDropped.join('; ')}` : ''}`)
  if (city.redditSourcedNotes) report.push(`  - notes: ${str(city.redditSourcedNotes, 500)}`)
}

cities.sort((a, b) => a.name.localeCompare(b.name))
spots.sort((a, b) => a.city.localeCompare(b.city) || b.lowkeyScore - a.lowkeyScore || a.name.localeCompare(b.name))
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify({ cities, spots }, null, 0))
writeFileSync(OUT_DETAILS, JSON.stringify(details, null, 0))
writeFileSync(REPORT, `# Research report\n\nGenerated from ${files.length} city files. ${spots.length} spots across ${cities.length} cities; ${dropped} dropped by validation.\n\n${report.join('\n')}\n`)
const kb = (p) => Math.round(readFileSync(p, 'utf8').length / 1024)
console.log(`dataset: ${cities.length} cities, ${spots.length} spots (${dropped} dropped)`)
console.log(`  src/data/spots.json        ${kb(OUT)} KB  (bundled: what lists and ranking need)`)
console.log(`  src/data/spot-details.json ${kb(OUT_DETAILS)} KB  (lazy chunk: blurb, tips, sources)`)
