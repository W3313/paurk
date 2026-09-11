// Rasterises public/icon.svg into the PNG sizes the web manifest asks for.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const svg = readFileSync('public/icon.svg', 'utf8')
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
for (const size of [180, 192, 512]) {
  const ctx = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`)
  await page.waitForTimeout(150)
  const out = size === 180 ? 'public/apple-touch-icon.png' : `public/icon-${size}.png`
  await page.screenshot({ path: out })
  console.log('wrote', out)
  await ctx.close()
}
await browser.close()
