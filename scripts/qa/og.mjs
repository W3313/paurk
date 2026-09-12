// Renders the social preview card (1200x630) from the app itself: the globe, the wordmark and the
// tagline, with the live clock and the controls removed so the card does not read as stale.
// Usage: node scripts/qa/og.mjs [url] [outFile]   (needs `vite preview` running)
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://127.0.0.1:4173/'
const out = process.argv[3] ?? 'public/og.jpg'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(3800)

// Styling only: never mutate React's own DOM here, it makes the reconciler throw.
// The counts come from the dataset so the card cannot claim a total the app no longer has.
const { cities, spots } = JSON.parse(readFileSync(new URL('../../src/data/spots.json', import.meta.url), 'utf8'))
const plate = `the world · ${cities.length} cities · ${spots.length} places`

await page.addStyleTag({ content: `
  /* The card is the sphere and two lines; everything the app needs to be usable goes away. */
  .header, .citymenu, .note, .only-mobile { display: none !important }
  .side--cities { opacity: 0 !important }
  /* The sky seats the sphere beside its column; with the column gone, recentre and lift it. */
  .stage { transform: translate(calc(var(--column) / -2), -58px) scale(.58) !important }
  body::before {
    content: 'Paurk';
    position: fixed; left: 0; right: 0; top: 64px; text-align: center;
    font-family: var(--font-display); font-style: italic; font-weight: 300; font-size: 44px; color: var(--ink-2);
    z-index: 20;
  }
  body::after {
    content: '${plate}\\A somewhere to breathe, wherever, whenever';
    white-space: pre; position: fixed; left: 0; right: 0; bottom: 58px; text-align: center; line-height: 2.2;
    font-family: var(--font-display); font-weight: 300; font-size: 30px; color: var(--ink);
    z-index: 20;
  }
` })
await page.waitForTimeout(600)
await page.screenshot({ path: out, type: 'jpeg', quality: 88 })
await browser.close()
console.log('wrote', out)
