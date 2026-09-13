// Vibe filtering behind one word, and no invented distance-from-centre on any row.
import { chromium } from 'playwright'
const out = process.env.QA_OUT ?? '/tmp'
const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 1440, height: 980 }, colorScheme: 'dark' })
const errs = []; p.on('pageerror', (e) => errs.push(e.message))
let failed = 0
const ok = (n, c, x = '') => { if (!c) failed++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${!c && x ? ' — ' + x : ''}`) }
// The disclosure is a 240ms grid-template-rows transition, but this runs against a software renderer
// with a globe on the same main thread, where 240ms of animation can take well over a second of wall
// clock. Wait for the height to stop changing rather than for a number of milliseconds.
const clipH = () => p.evaluate(() => document.querySelector('.vibes-clip')?.getBoundingClientRect().height ?? -1)
/** Poll until the panel reaches the height the assertion is about, then report whatever it actually is. */
async function clipUntil(pred) {
  for (let i = 0; i < 80; i++) {
    const h = await clipH()
    if (pred(h)) return h
    await p.waitForTimeout(100)
  }
  return clipH()
}
await p.goto((process.argv[2] ?? 'http://127.0.0.1:4173/') + '#/c/san-francisco', { waitUntil: 'networkidle' }); await p.waitForTimeout(2600)
const col = () => p.locator('.side--spots').textContent()
ok('no from-centre anywhere', !/from centre|from the centre/.test((await col()) ?? ''))
const trig = p.locator('.vibes-trigger')
ok('trigger starts collapsed', (await trig.getAttribute('aria-expanded')) === 'false')
ok('chips are inert while closed', await p.evaluate(() => !!document.querySelector('.vibes')?.closest('[inert]') || document.querySelector('.vibes')?.hasAttribute('inert')))
const hClosed = await clipUntil((h) => h < 2)
await trig.click()
const hOpen = await clipUntil((h) => h > 40)
ok('panel opens to a real height', hClosed < 2 && hOpen > 40, `${hClosed} -> ${hOpen}`)
ok('trigger reports expanded', (await trig.getAttribute('aria-expanded')) === 'true')
await p.locator('.vibe').first().click(); await p.waitForTimeout(500)
ok('picking a vibe filters', /\?v=/.test(await p.evaluate(() => location.hash)), await p.evaluate(() => location.hash))
ok('what is on is printed on the head', ((await p.locator('.vibes-on').textContent()) ?? '').length > 2)
await p.keyboard.press('Escape'); await p.waitForTimeout(400)
ok('escape collapses it', (await trig.getAttribute('aria-expanded')) === 'false')
ok('the filter survives collapsing', /\?v=/.test(await p.evaluate(() => location.hash)))
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no page errors')
await b.close()
if (failed || errs.length) process.exit(1)
