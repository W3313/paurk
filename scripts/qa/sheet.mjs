// The mobile city page: the list is the screen, the scroll means one thing, and there is one way back.
//
// This file has outlived three designs, each of which broke in a way no DOM assertion caught.
// Detents with a `show more` word, because the run-up was `pointer-events: none` and a drag over it
// reached the globe instead of scrolling. Then a long transparent run-up, which made the list reachable
// but spent most of the scroll on empty travel. Then a pull-past-the-top exit on the same scroller,
// which asked the scroll position to mean two things at once. What is checked here is the property all
// three failed: a thumb landing where a thumb lands does the one obvious thing.
import { chromium } from 'playwright'
const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const base = process.argv[2] ?? 'http://127.0.0.1:4173/'
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' })
const errs = []; p.on('pageerror', (e) => errs.push(e.message))
let failed = 0
const ok = (n, c, x = '') => { if (!c) failed++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${!c && x !== '' ? ' — ' + x : ''}`) }
const backWord = () => p.evaluate(() => {
  const el = [...document.querySelectorAll('.panel-sticky button')].find((x) => x.textContent.trim().startsWith('←'))
  if (!el) return null
  const r = el.getBoundingClientRect()
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
  return { text: el.textContent.trim(), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
    reachable: hit === el || el.contains(hit), count: document.querySelectorAll('.panel-sticky button, .spot-bar button').length }
})
const state = () => p.evaluate(() => {
  const el = document.querySelector('[data-sheet]'), bar = document.querySelector('.panel-sticky')
  const col = document.querySelector('.panel .column'), row = document.querySelector('.rows a.row')
  const r = row?.getBoundingClientRect()
  return { hash: location.hash, top: el ? Math.round(el.scrollTop) : null,
    barBottom: bar ? Math.round(bar.getBoundingClientRect().bottom) : null,
    colTop: col ? Math.round(col.getBoundingClientRect().top) : null,
    firstRow: r ? Math.round(r.top) : null }
})

await p.goto(base + '#/c/berkeley', { waitUntil: 'networkidle' })
await p.waitForTimeout(3000)
const open = await state()
ok('the list opens at the top, with nothing to scroll past', open.top === 0, `scrollTop ${open.top}`)
ok('the first spot row is on screen straight away', open.firstRow !== null && open.firstRow < 844, `firstRow ${open.firstRow}`)
// The scroller starts below the header; at inset 0 the sticky bar offset down onto the column's own lines.
ok('the sticky bar does not sit on the column', open.colTop >= open.barBottom, `col ${open.colTop} < bar ${open.barBottom}`)
ok('the light is on the page, not left behind the globe', await p.evaluate(() => !!document.querySelector('.phase')?.textContent?.trim()))
ok('nothing to tap to see the list', await p.evaluate(() => !/show (more|less)/.test(document.body.innerText)))
ok('the old run-up and pull-back zones are gone', await p.evaluate(() =>
  !document.querySelector('.sheet-lead') && !document.querySelector('.sheet-exit')))

const bw = await backWord()
ok('one back word, from the start', bw && bw.text === '← globe' && bw.count === 1, JSON.stringify(bw))
ok('it is reachable and 44px', bw && bw.reachable && bw.h >= 44 && bw.w >= 44, JSON.stringify(bw))

// Scroll carries one meaning: down goes down the list, and back to the top stays put.
await p.mouse.move(195, 500); await p.mouse.wheel(0, 600); await p.waitForTimeout(700)
const down = await state()
ok('scrolling scrolls the list and nothing else', down.top > 400 && down.hash === open.hash, JSON.stringify(down))
await p.mouse.wheel(0, -1800); await p.waitForTimeout(900)
const up = await state()
ok('scrolling back to the very top stays in the city', up.top === 0 && up.hash === open.hash, JSON.stringify(up))

await p.evaluate(() => [...document.querySelectorAll('.panel-sticky button')].find((x) => x.textContent.trim().startsWith('←')).click())
await p.waitForTimeout(1500)
ok('← globe returns to the globe', await p.evaluate(() =>
  ['#/', ''].includes(location.hash) && !!document.querySelector('.sky-text') && !document.querySelector('[data-sheet]')),
  await p.evaluate(() => location.hash))

// A spot page is the same shape, one step further in.
await p.goto(base + '#/c/lisbon', { waitUntil: 'networkidle' }); await p.waitForTimeout(2600)
await p.evaluate(() => document.querySelector('.rows a.row')?.click()); await p.waitForTimeout(1600)
const sb = await backWord()
ok('a spot page carries one back word, to its city', sb && sb.text.startsWith('← ') && sb.text !== '← globe' && sb.count === 1, JSON.stringify(sb))
ok('and it is reachable', sb && sb.reachable, JSON.stringify(sb))
await p.evaluate(() => [...document.querySelectorAll('.panel-sticky button')].find((x) => x.textContent.trim().startsWith('←')).click())
await p.waitForTimeout(1200)
ok('it goes back to the list, not out to the globe', (await p.evaluate(() => location.hash)).includes('lisbon'), await p.evaluate(() => location.hash))

await p.goto(base + '#/saved', { waitUntil: 'networkidle' }); await p.waitForTimeout(2400)
ok('saved is the same page with the same way back', await p.evaluate(() => {
  const el = [...document.querySelectorAll('.panel-sticky button')].find((x) => x.textContent.trim().startsWith('←'))
  return !!document.querySelector('[data-sheet]') && !!el
}))

ok('no page errors', errs.length === 0, errs.join(' | '))
console.log(errs.length ? `page errors: ${errs.join(' | ')}` : 'no page errors')
await b.close()
process.exit(failed ? 1 : 0)
