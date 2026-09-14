// Interaction smoke test: drives the real flows in headless Chromium and fails on page errors.
import { chromium } from 'playwright'
const base = process.argv[2] ?? 'http://127.0.0.1:4173/'
import { executablePath as exe } from './chromium.mjs'
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errors = []
const results = []
const check = (name, ok, extra = '') => { results.push(`${ok ? 'ok ' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`) }
for (const [label, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  try {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: mobile, isMobile: mobile })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`[${label}] ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load|net::/.test(m.text())) errors.push(`[${label}] console: ${m.text().slice(0, 200)}`) })
  await page.goto(base + '#/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  // 1. a city word in the sky list flies to the city (the left column on desktop, the stack on phones)
  const cityWord = page.locator('.citymenu a.word, .worldnow a.word').first()
  const cityName = (await cityWord.textContent())?.trim()
  await cityWord.click()
  await page.waitForTimeout(2300)
  check(`${label}: city word opens city`, (await page.locator('.app').getAttribute('data-mode')) === 'city', `(${cityName})`)
  check(`${label}: hash is city route`, /^#\/c\//.test(await page.evaluate(() => location.hash)), await page.evaluate(() => location.hash))
  // Exactly one voice: a second mounted margin note would race the first for the same queue.
  const live = await page.evaluate(() => [...document.querySelectorAll('[role=status]')]
    .filter((e) => e.getAttribute('aria-live') !== 'off')
    .filter((e) => e.getClientRects().length > 0 && !e.closest('[inert]') && !e.closest('dialog:not([open])')).length)
  check(`${label}: one live region`, live === 1, String(live))
  // 2. vibe filter toggles and margin note updates (the chips live behind the trigger now)
  await page.locator('.vibes-trigger').click()
  await page.waitForTimeout(350)
  const vibe = page.locator('.vibe').first()
  await vibe.click()
  await page.waitForTimeout(400)
  check(`${label}: vibe pressed`, (await vibe.getAttribute('aria-pressed')) === 'true')
  check(`${label}: ?v= in hash`, /\?v=/.test(await page.evaluate(() => location.hash)), await page.evaluate(() => location.hash))
  await vibe.click()
  // 3. open the first row, save it, share word exists, back to list
  await page.locator('a.row').first().click()
  await page.waitForTimeout(1200)
  check(`${label}: spot opened`, (await page.locator('.app').getAttribute('data-mode')) === 'spot')
  const save = page.locator('button.word[aria-pressed]').filter({ hasText: /^save|saved/ }).first()
  await save.click()
  await page.waitForTimeout(300)
  check(`${label}: saved`, (await save.getAttribute('aria-pressed')) === 'true', await save.textContent())
  check(`${label}: saved count in header`, /Saved, 1 spot/.test((await page.locator('header a.saved-trigger').getAttribute('aria-label')) ?? ''))
  // 4. saved page lists it
  await page.locator('header a.saved-trigger').click()
  await page.waitForTimeout(800)
  check(`${label}: saved page has a row`, (await page.locator('a.row').count()) >= 1)
  // 5. find: type and pick
  await page.locator('header button.find-trigger').click()
  await page.waitForTimeout(300)
  await page.locator('input.search').fill('tok')
  await page.waitForTimeout(300)
  const tokyo = page.locator('dialog[open] [role=option]', { hasText: 'Tokyo' }).first()
  check(`${label}: find filters`, (await tokyo.count()) === 1)
  await tokyo.click()
  await page.waitForTimeout(2300)
  check(`${label}: find opens Tokyo`, (await page.evaluate(() => location.hash)) === '#/c/tokyo', await page.evaluate(() => location.hash))
  // 6. sun-rule preview changes the phase line
  const before = await page.locator('.phase').first().textContent()
  await page.locator('input[type=range]').first().focus()
  await page.keyboard.press('PageUp')
  await page.waitForTimeout(500)
  const after = await page.locator('.phase').first().textContent()
  check(`${label}: preview prefix`, /if it were/.test(after ?? ''), `${before} -> ${after}`)
  await page.locator('button.word', { hasText: /^now$/ }).first().click()
  // 7. escape back to sky
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1600)
  check(`${label}: escape to sky`, (await page.locator('.app').getAttribute('data-mode')) === 'sky')
  // 8. about dialog + still toggle
  if (!mobile) {
    await page.locator('header button.word', { hasText: 'about' }).click()
    await page.waitForTimeout(300)
    await page.locator('dialog[open] button.word', { hasText: /^still/ }).click()
    check(`${label}: still sets data-still`, await page.evaluate(() => document.documentElement.hasAttribute('data-still')))
    await page.locator('dialog[open] button.word', { hasText: /^still/ }).click()
    await page.keyboard.press('Escape')
  }
  // 9. keyboard on globe: page down cycles focus, enter opens
  await page.locator('canvas.paurk-globe-canvas').focus()
  await page.keyboard.press('PageDown')
  await page.waitForTimeout(600)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2200)
  check(`${label}: keyboard opens a city`, (await page.locator('.app').getAttribute('data-mode')) === 'city')
  await ctx.close()
  } catch (e) { errors.push(`[${label}] flow aborted: ${String(e.message).split('\n')[0]}`) }
}
await browser.close()
console.log(results.join('\n'))
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors')
if (errors.length || results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1
