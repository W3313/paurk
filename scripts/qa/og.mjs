// Renders the social preview card (1200x630) from the app itself: the globe, the wordmark and the
// tagline, with the live clock and the controls removed so the card does not read as stale.
// Usage: node scripts/qa/og.mjs [url] [outFile]   (needs `vite preview` running)
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://127.0.0.1:4173/'
const out = process.argv[3] ?? 'public/og.jpg'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(3800)

// Styling only: never mutate React's own DOM here, it makes the reconciler throw.
// The clock lines are blanked and replaced through pseudo-elements so the card does not read as stale.
await page.addStyleTag({ content: `
  .worldnow, .serendipity, .only-mobile, .note, header nav, .sky-text .words, .golden-num, .veil { display: none !important }
  .sky .stage { width: 430px !important; height: 430px !important; margin: 20px auto 0 !important }
  .sky-text { width: 700px !important; gap: 16px !important; padding-bottom: 0 !important }
  .plate { font-size: 0 !important }
  .plate::after { content: 'plate · the world · 43 cities · 590 places'; font-size: 13px; letter-spacing: .06em }
  .phase { font-size: 0 !important }
  .phase::after { content: 'somewhere to breathe, wherever, whenever'; font-size: 34px; font-family: var(--font-display); font-weight: 300 }
` })
await page.waitForTimeout(600)
await page.screenshot({ path: out, type: 'jpeg', quality: 88 })
await browser.close()
console.log('wrote', out)
