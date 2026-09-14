// The globe's layers: what is drawn at each depth, and what is fetched to draw it.
//
// The resting sky is the signature view and must stay one dot lattice and nothing else — an earlier
// level-of-detail shipped a globe with everything below the Arctic missing, so "the world is on it"
// is checked here against pixels, not against a uniform. The heavier layers are lazy on purpose:
// first paint pays for 12.5 KB, and the rest arrives only if someone zooms in.
import { chromium } from 'playwright'
import { executablePath as exe } from './chromium.mjs'
const base = process.argv[2] ?? 'http://127.0.0.1:4173/'
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 1000, height: 800 }, colorScheme: 'dark', reducedMotion: 'reduce' })
const errs = []; p.on('pageerror', (e) => errs.push(e.message))
const got = []; p.on('request', (r) => { const m = /globe-[\w-]+\.bin/.exec(r.url()); if (m) got.push(m[0]) })
let failed = 0
const ok = (n, c, x = '') => { if (!c) failed++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${!c && x !== '' ? ' — ' + x : ''}`) }
// A normal desktop; the headless box reports two cores, which trips the engine's low-end path.
await p.addInitScript(() => { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 }) })

await p.goto(`${base}#/?t=720`, { waitUntil: 'networkidle' })
await p.waitForTimeout(4000)
ok('at rest only the coarse lattice is fetched', got.length === 1 && got[0] === 'globe-dots.bin', got.join(', '))


await p.locator('canvas').first().focus()
// Far enough in for borders, not far enough for coastlines.
await p.evaluate(() => { document.querySelector('canvas').dispatchEvent(new WheelEvent('wheel', { deltaY: -600, bubbles: true, cancelable: true })) })
for (let i = 0; i < 4; i++) { await p.keyboard.press('+'); await p.waitForTimeout(120) }
await p.waitForTimeout(2500)
ok('zooming in brings the borders', got.includes('globe-borders.bin'), got.join(', '))
ok('and the fine lattice', got.includes('globe-dots-fine.bin'), got.join(', '))
ok('but not yet the coastlines', !got.includes('globe-coast.bin'), got.join(', '))

for (let i = 0; i < 8; i++) { await p.keyboard.press('+'); await p.waitForTimeout(120) }
await p.waitForTimeout(3000)
const deep = await p.evaluate(() => ({
  canvas: !!document.querySelector('canvas'),
  labelled: !!document.querySelector('.paurk-label'),
}))
ok('the coastlines arrive at depth', got.includes('globe-coast.bin'), got.join(', '))
ok('the canvas survives the deepest zoom', deep.canvas)
ok('each file is fetched exactly once', new Set(got).size === got.length, got.join(', '))
ok('no page errors', errs.length === 0, errs.join(' | '))
console.log(errs.length ? `page errors: ${errs.join(' | ')}` : 'no page errors')
await b.close()
process.exit(failed ? 1 : 0)
