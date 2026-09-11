// Finds what forces horizontal overflow on a phone-sized mobile viewport.
import { chromium } from 'playwright'
const route = process.argv[2] ?? '#/c/lisbon'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:4173/' + route, { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
console.log(await page.evaluate(() => {
  const w = window.innerWidth
  const clips = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o !== 'visible') return true } return false }
  const wide = [...document.querySelectorAll('body *')].map((el) => ({ el, r: el.getBoundingClientRect() })).filter(({ el, r }) => r.right > w + 1 && r.width > 0 && !clips(el)).sort((a, b) => b.r.right - a.r.right).slice(0, 10)
    .map(({ el, r }) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} right=${Math.round(r.right)} w=${Math.round(r.width)} text=${(el.textContent || '').trim().slice(0, 30)}`)
  const scrollers = [...document.querySelectorAll('body *')].filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible').slice(0, 10).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} sw=${el.scrollWidth} cw=${el.clientWidth}`)
  return { hash: location.hash, mode: document.querySelector('.app')?.getAttribute('data-mode'), innerWidth: w, docScrollWidth: document.documentElement.scrollWidth, wide, scrollers }
}))
await browser.close()
