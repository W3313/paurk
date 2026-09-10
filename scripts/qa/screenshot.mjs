// Renders the built app in headless Chromium and saves screenshots (desktop + phone).
// Usage: node scripts/qa/screenshot.mjs <url> <outDir> [hashRoute]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const [,, url = 'http://127.0.0.1:4173/', outDir = 'qa-shots', hash = ''] = process.argv
mkdirSync(outDir, { recursive: true })
const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const errors = []
for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: 'no-preference' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${name}] console.${m.type()}: ${m.text()}`) })
  await page.goto(url + hash, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${outDir}/${name}.png` })
  await ctx.close()
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors')
