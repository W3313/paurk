// Berkeley, the 44th city: route, row count, a caution in the list, search, and a spot page.
import { chromium } from 'playwright'
import { executablePath as exe } from './chromium.mjs'
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 1440, height: 980 }, colorScheme: 'dark' })
const errs = []; p.on('pageerror', (e) => errs.push(e.message))
let failed = 0
const ok = (n, c, x = '') => { if (!c) failed++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${!c && x ? ' — ' + x : ''}`) }
await p.goto((process.argv[2] ?? 'http://127.0.0.1:4173/') + '#/c/berkeley', { waitUntil: 'networkidle' }); await p.waitForTimeout(2800)
ok('berkeley route resolves', (await p.evaluate(() => location.hash)) === '#/c/berkeley', await p.evaluate(() => location.hash))
const n = await p.locator('a.row').count()
ok('fourteen rows', n === 14, String(n))
const rows = (await p.locator('.side--spots').textContent()) ?? ''
ok('a caution shows in the list', /caution/.test(rows))
await p.keyboard.press('/'); await p.waitForTimeout(500)
await p.keyboard.type('berkel'); await p.waitForTimeout(600)
const first = await p.locator('dialog[open] [role=option]').first().getAttribute('aria-label')
ok('search puts Berkeley first', /^(Current: )?Berkeley,/.test(first ?? ''), first ?? 'none')
await p.keyboard.press('Escape'); await p.waitForTimeout(500)
await p.locator('a.row').first().click(); await p.waitForTimeout(1800)
ok('spot page opens', /^#\/s\/berkeley\//.test(await p.evaluate(() => location.hash)), await p.evaluate(() => location.hash))
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no page errors')
await b.close()
if (failed || errs.length) process.exit(1)
