import { chromium } from 'playwright'
const route = process.argv[2] ?? '#/s/lisbon/miradouro-do-monte-agudo'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load/.test(m.text())) console.log('console.error', m.text().slice(0, 200)) })
await page.goto('http://127.0.0.1:4173/' + route, { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
console.log(await page.evaluate(() => ({
  hash: location.hash,
  mode: document.querySelector('.app')?.getAttribute('data-mode'),
  hasSpot: !!document.querySelector('.spot'),
  vibesCount: document.querySelectorAll('.vibes').length,
  vibesWhere: [...document.querySelectorAll('.vibes')].map((v) => v.closest('section, aside, dialog, .panel, .sky-text')?.className ?? v.parentElement?.className),
  innerWidth: innerWidth,
})))
await browser.close()
