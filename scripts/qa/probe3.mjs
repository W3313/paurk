import { chromium } from 'playwright'
const route = '#/s/lisbon/miradouro-do-monte-agudo'
const tests = {
  none: '',
  svgstatic: '.photo svg{position:static !important;width:100% !important;height:auto !important}',
  svghide: '.photo svg{display:none !important}',
  barstatic: '.spot-bar{position:static !important}',
  barmargin: '.spot-bar{margin:0 !important}',
  photoheight: '.photo{aspect-ratio:auto !important;height:240px !important}',
  photoblock: '.photo{display:block !important;width:358px !important}',
  spotblock: '.spot{display:block !important}',
  headblock: '.column-head{display:block !important}',
  colblock: '.column{display:block !important}',
}
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
for (const [name, css] of Object.entries(tests)) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  await page.addInitScript((c) => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = c; document.head.appendChild(s) }) }, css)
  await page.goto('http://127.0.0.1:4173/' + route, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const r = await page.evaluate(() => ({ w: innerWidth, sw: document.documentElement.scrollWidth, widest: [...document.querySelectorAll('body *')].map((el) => ({ el, sw: el.scrollWidth })).sort((a, b) => b.sw - a.sw).slice(0, 3).map(({ el, sw }) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}=${sw}`) }))
  console.log(name.padEnd(12), r.w, r.sw, r.widest.join(' | '))
  await ctx.close()
}
await browser.close()
