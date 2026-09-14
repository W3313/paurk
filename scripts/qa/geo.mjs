// around me: the three outcomes (near a city, far from all of them, refused).
import { chromium } from 'playwright'
const base = process.argv[2] ?? 'http://127.0.0.1:4173/'
import { executablePath as exe } from './chromium.mjs'
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
let failed = 0
const ok = (n, c, extra = '') => { if (!c) failed++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${!c && extra ? ' — ' + extra : ''}`) }

async function run(name, geo, grant) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark',
    ...(geo ? { geolocation: geo, permissions: grant ? ['geolocation'] : [] } : {}) })
  const p = await ctx.newPage()
  const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  await p.goto(base, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
  await p.keyboard.press('/'); await p.waitForTimeout(400)
  const around = p.locator('dialog[open] [role=option]', { hasText: 'around me' }).first()
  ok(`${name}: around me is offered`, await around.count() === 1)
  ok(`${name}: consent line precedes the prompt`,
    /We look at your location once/.test((await around.textContent()) ?? ''))
  await around.click()
  await p.waitForTimeout(4000)
  return { p, ctx, errs }
}

// near Tokyo
{
  const { p, ctx, errs } = await run('near', { latitude: 35.68, longitude: 139.76 }, true)
  ok('near: panel closed', await p.locator('dialog[open]').count() === 0)
  ok('near: opened the nearest city', (await p.evaluate(() => location.hash)) === '#/c/tokyo', await p.evaluate(() => location.hash))
  ok('near: no page errors', errs.length === 0, errs.join(' | '))
  await ctx.close()
}
// far out in the Pacific
{
  const { p, ctx, errs } = await run('far', { latitude: -30, longitude: -140 }, true)
  ok('far: panel stays open', await p.locator('dialog[open]').count() === 1)
  const note = await p.locator('.find-note').first().textContent().catch(() => null)
  ok('far: prints how far the nearest city is', /nearest city we know is .+ away/.test(note ?? ''), JSON.stringify(note))
  const head = await p.locator('dialog[open] .region-head').first().textContent().catch(() => null)
  ok('far: switches to the list sorted by distance', head === 'nearest to you', JSON.stringify(head))
  ok('far: no page errors', errs.length === 0, errs.join(' | '))
  await ctx.close()
}
// refused
{
  const { p, ctx, errs } = await run('denied', { latitude: 0, longitude: 0 }, false)
  ok('denied: panel stays open', await p.locator('dialog[open]').count() === 1)
  const note = await p.locator('.find-note').first().textContent().catch(() => null)
  ok('denied: says so without blaming the user', /no location/.test(note ?? ''), JSON.stringify(note))
  ok('denied: falls back to the full city list', await p.locator('dialog[open] [role=option]').count() >= 43)
  ok('denied: no page errors', errs.length === 0, errs.join(' | '))
  await ctx.close()
}
await b.close()
if (failed) process.exit(1)