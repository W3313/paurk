// Salvages stage-1 research drafts from workflow journals for cities whose verify stage never ran.
// Writes data/research/<slug>.json with verified:false so the build can treat them honestly.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const base = '/root/.claude/projects/-home-user-TrueChiller/9ffbcae7-6db4-5daa-ab54-b0b68957fb57/subagents/workflows'
const out = resolve('data/research')
const regionOf = { 'wf_afa15f94-f94': 'americas', 'wf_85d6c8fe-ed0': 'europe-africa', 'wf_9a6e68ce-ae6': 'asia-pacific' }
let written = 0, skipped = 0
for (const dir of readdirSync(base)) {
  const region = regionOf[dir]
  if (!region) continue
  const lines = readFileSync(resolve(base, dir, 'journal.jsonl'), 'utf8').split('\n').filter(Boolean)
  const labels = new Map()
  for (const line of lines) {
    let j
    try { j = JSON.parse(line) } catch { continue }
    if (j.type === 'started' && j.key) labels.set(j.key, j.label)
  }
  for (const line of lines) {
    let j
    try { j = JSON.parse(line) } catch { continue }
    if (j.type !== 'result') continue
    const label = j.label ?? labels.get(j.key) ?? ''
    if (!label.startsWith('research:')) continue
    const r = j.result
    if (!r || !r.slug || !Array.isArray(r.spots)) continue
    const file = resolve(out, `${r.slug}.json`)
    if (existsSync(file)) { skipped++; continue }
    const doc = {
      city: r.city, country: r.country, slug: r.slug, region,
      cityLat: r.cityLat, cityLng: r.cityLng, timezone: r.timezone,
      searchesRun: r.searchesRun, redditSourcedNotes: `${r.redditSourcedNotes ?? ''} VERIFIER NOTE: the independent verify stage for this city did not run (web-search budget and session limit exhausted); spots carry verified:false and were screened only by build-time checks.`,
      spots: r.spots.map((s) => ({ ...s, verified: false, verifyNote: 'not independently reviewed' })),
    }
    writeFileSync(file, JSON.stringify(doc, null, 2))
    written++
    console.log(`salvaged ${r.slug}: ${r.spots.length} spots`)
  }
}
console.log(`written ${written}, skipped (already verified) ${skipped}`)
