// Find panel: keyboard, combobox semantics and focus return. Fails the build on any regression.
import { chromium } from 'playwright'
const base = process.argv[2] ?? 'http://127.0.0.1:4173/'
const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' })
const errs = []; p.on('pageerror', (e) => errs.push(e.message))
let failed = 0
const ok = (n, c, extra='') => { if (!c) failed++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${extra ? ' ' + extra : ''}`) }
const val = () => p.locator('input.search').inputValue()
const activeText = () => p.locator('dialog[open] [role=option][aria-selected=true]').first().textContent()
const activeId = () => p.evaluate(() => document.querySelector('dialog[open] [role=option][aria-selected=true]')?.id)

await p.goto(base, { waitUntil: 'networkidle' }); await p.waitForTimeout(1600)

// "/" opens and does not type a slash
await p.keyboard.press('/'); await p.waitForTimeout(400)
ok('slash opens find', await p.locator('dialog[open]').count() === 1)
ok('slash is not typed into the field', (await val()) === '', JSON.stringify(await val()))
ok('input is focused on a fine pointer', await p.evaluate(() => document.activeElement?.id) === 'find-input')

// arrow wrapping
const first = await activeId()
await p.keyboard.press('ArrowUp'); await p.waitForTimeout(200)
const last = await activeId()
ok('ArrowUp from the first option wraps to the last', last === 'find-opt-all', String(last))
await p.keyboard.press('ArrowDown'); await p.waitForTimeout(200)
ok('ArrowDown wraps back to the first', (await activeId()) === first, String(first))

// aria wiring
const aad = await p.locator('input.search').getAttribute('aria-activedescendant')
ok('aria-activedescendant names a real element', await p.evaluate((id) => !!document.getElementById(id), aad), aad ?? '')
ok('aria-controls names the listbox', await p.evaluate(() => {
  const c = document.querySelector('input.search')?.getAttribute('aria-controls')
  return !!c && document.getElementById(c)?.getAttribute('role') === 'listbox' }))
ok('every option has an accessible name', await p.evaluate(() =>
  [...document.querySelectorAll('dialog[open] [role=option]')].every((e) => (e.getAttribute('aria-label') ?? '').length > 3)))
ok('option ids are unique', await p.evaluate(() => {
  const ids = [...document.querySelectorAll('dialog[open] [role=option]')].map((e) => e.id)
  return ids.length > 3 && new Set(ids).size === ids.length }))
ok('only one live region is announcing', await p.evaluate(() =>
  [...document.querySelectorAll('[role=status]')].filter((e) => e.getAttribute('aria-live') !== 'off').length === 1))

// typing, then Enter on the top hit
await p.keyboard.type('kiyosumi'); await p.waitForTimeout(400)
ok('typing re-aims at the top hit', /Kiyosumi/.test((await activeText()) ?? ''), JSON.stringify(await activeText()))
await p.keyboard.press('Enter'); await p.waitForTimeout(2400)
ok('Enter opens the spot', (await p.evaluate(() => location.hash)).startsWith('#/s/tokyo/'), await p.evaluate(() => location.hash))
ok('panel closed after activation', await p.locator('dialog[open]').count() === 0)

// Escape closes in one press, focus returns to the trigger
await p.keyboard.press('/'); await p.waitForTimeout(400)
await p.keyboard.type('gard'); await p.waitForTimeout(300)
await p.keyboard.press('Escape'); await p.waitForTimeout(400)
ok('Escape closes in one press even with a query', await p.locator('dialog[open]').count() === 0)
// Native focus return goes to whatever was focused before showModal — here the spot heading, which
// is where the reader was. The trigger fallback is only for the case where nothing was focused.
ok('focus returns where the reader was', await p.evaluate(() => document.activeElement !== document.body))
await p.evaluate(() => document.querySelector('a[href="#/"]')?.click())
await p.waitForTimeout(1200)
await p.evaluate(() => document.activeElement?.blur?.())
await p.keyboard.press('/'); await p.waitForTimeout(500)
ok('slash reopens after going back to the sky', await p.locator('dialog[open]').count() === 1)
await p.keyboard.press('Escape'); await p.waitForTimeout(500)
ok('opened from nothing, focus lands on the trigger', await p.evaluate(() => !!document.activeElement?.classList?.contains('find-trigger')), await p.evaluate(() => document.activeElement?.tagName + '.' + (document.activeElement?.className || '')))

// reopening resets the query
await p.keyboard.press('/'); await p.waitForTimeout(400)
ok('reopening starts empty', (await val()) === '', JSON.stringify(await val()))

// End then Enter reaches browse without typing
await p.keyboard.press('End'); await p.waitForTimeout(200)
await p.keyboard.press('Enter'); await p.waitForTimeout(400)
ok('End+Enter reaches the full city list', await p.locator('dialog[open] [role=option]').count() >= 43, String(await p.locator('dialog[open] [role=option]').count()))
ok('panel stays open on browse', await p.locator('dialog[open]').count() === 1)

console.log(errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'no page errors')
await b.close()
if (failed || errs.length) process.exit(1)
