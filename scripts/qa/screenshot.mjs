// Renders the built app in headless Chromium and saves screenshots for several routes at
// desktop and phone sizes, collects console errors, and fails on tap targets under 44px (phone).
// Usage: node scripts/qa/screenshot.mjs <baseUrl> <outDir> [route ...]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const [,, url = 'http://127.0.0.1:4173/', outDir = 'qa-shots', ...routes] = process.argv
const ROUTES = routes.length ? routes : ['#/', '#/c/lisbon', '#/s/lisbon/miradouro-de-santa-catarina', '#/stones']
mkdirSync(outDir, { recursive: true })
const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const errors = []
const small = []
for (const [name, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] console.error: ${m.text().slice(0, 300)}`) })
  for (const r of ROUTES) {
    const slug = r.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'sky'
    await page.goto(url + r, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2600)
    await page.screenshot({ path: `${outDir}/${name}-${slug}.png` })
    if (mobile) {
      const bad = await page.$$eval('a, button, [role=button], input', (els) => els.filter((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && (r.width < 44 || r.height < 44) && !el.closest('.paurk-globe-labels') }).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`))
      for (const b of bad) small.push(`[${r}] ${b}`)
    }
  }
  await ctx.close()
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors')
if (small.length) { console.log('tap targets under 44px:\n' + small.join('\n')); process.exitCode = 1 }
else console.log('all tap targets >= 44px on phone')
