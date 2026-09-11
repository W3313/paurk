import { chromium } from 'playwright'
const route = process.argv[2] ?? '#/s/lisbon/miradouro-do-monte-agudo'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
await page.addInitScript(() => {
  window.__frames = []
  const tick = () => {
    const w = innerWidth
    const widest = [...document.querySelectorAll('body *')].map((el) => { const r = el.getBoundingClientRect(); return { el, right: r.right, w: r.width } }).filter((x) => x.w > 0).sort((a, b) => b.right - a.right).slice(0, 4)
    window.__frames.push({ t: performance.now().toFixed(0), innerWidth: w, sw: document.documentElement.scrollWidth, widest: widest.map((x) => `${x.el.tagName.toLowerCase()}.${[...x.el.classList].join('.')}[r=${Math.round(x.right)},w=${Math.round(x.w)}]`) })
    if (window.__frames.length < 120) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})
await page.goto('http://127.0.0.1:4173/' + route, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
const frames = await page.evaluate(() => window.__frames)
let prev = ''
for (const f of frames) { const line = `${f.innerWidth}/${f.sw} ${f.widest.join(' ')}`; if (line !== prev) { console.log(f.t, line); prev = line } }
await browser.close()
