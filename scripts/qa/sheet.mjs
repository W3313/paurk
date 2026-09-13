// The mobile sheet: the spots list must be reachable by scrolling, with nothing to tap first.
//
// This guards a bug that was invisible to every other check. The sheet was `pointer-events: none` with
// none again on its spacers, so the top 72dvh of a city screen was a hole through to the globe canvas —
// which pins `touchAction` at 'none' — and a downward drag spun the sphere instead of scrolling. The
// list sat below the fold with no way to reach it but a `show more` word in the sticky header. Nothing
// was broken in a way a DOM assertion would catch; it needed a gesture that starts where a thumb starts.
import { chromium } from 'playwright'
const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const base = process.argv[2] ?? 'http://127.0.0.1:4173/'
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' })
const errs = []; p.on('pageerror', (e) => errs.push(e.message))
let failed = 0
const ok = (n, c, x = '') => { if (!c) failed++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${!c && x !== '' ? ' — ' + x : ''}`) }

await p.goto(base + '#/c/berkeley', { waitUntil: 'networkidle' })
await p.waitForTimeout(3200)

const S = () => p.evaluate(() => {
  const el = document.querySelector('[data-sheet]'), pan = document.querySelector('.panel')
  const row = document.querySelector('.rows a.row')?.getBoundingClientRect()
  return {
    top: Math.round(el.scrollTop), max: Math.round(el.scrollHeight - el.clientHeight), lead: pan.offsetTop,
    rest: document.querySelector('.sheet-exit')?.offsetHeight ?? 0,
    rowIn: row ? row.top >= 0 && row.bottom <= window.innerHeight : false,
  }
})
/** Poll rather than wait a fixed span: a smooth scroll takes over a second against a software renderer. */
const until = async (pred) => {
  let s = await S()
  for (let i = 0; i < 60 && !pred(s); i++) { await p.waitForTimeout(100); s = await S() }
  return s
}

const open = await S()
ok('the paperweight thumbnail is gone', await p.evaluate(() => document.querySelectorAll('.paperweight').length === 0))
ok('nothing to tap to see the list', await p.evaluate(() => !/show (more|less)/.test(document.body.innerText)))
ok('one lead block, no detent spacers', await p.evaluate(() => document.querySelectorAll('.sheet-lead').length === 1 && document.querySelectorAll('.sheet-spacer').length === 0))
ok('snap is off', await p.evaluate(() => getComputedStyle(document.querySelector('[data-sheet]')).scrollSnapType === 'none'))
// min-height: 100%, not 100dvh — otherwise the range falls short of the lead and progress never reaches 1.
ok('the scroll range covers the lead', open.max >= open.lead, `max ${open.max} < lead ${open.lead}`)
ok('the sheet is what the finger lands on, not the canvas', await p.evaluate(() => {
  const el = document.elementFromPoint(window.innerWidth / 2, 200)
  return !!el && !el.classList.contains('paurk-globe-canvas')
}), await p.evaluate(() => document.elementFromPoint(window.innerWidth / 2, 200)?.className))

// The gesture itself, started high on the sphere where the old build did nothing at all.
await p.mouse.move(195, 200)
await p.mouse.wheel(0, 260)
const moved = await until((s) => s.top > 200)
ok('a drag starting on the sphere scrolls the sheet', moved.top > 200, `scrollTop ${moved.top}`)
await p.waitForTimeout(700)
const held = await S()
ok('it stays where the finger left it', Math.abs(held.top - moved.top) < 4, `${moved.top} -> ${held.top}`)

await p.mouse.wheel(0, 500)
const listed = await until((s) => s.rowIn)
ok('scrolling on reaches the first spot row', listed.rowIn)

await p.evaluate(() => { document.querySelector('[data-sheet]').scrollTop = document.querySelector('.panel').offsetTop })
await p.waitForTimeout(600)
ok('the stage goes inert once the paper covers it', await p.evaluate(() => document.querySelector('.stage').hasAttribute('inert')))
const back = await p.evaluate(() => {
  const el = [...document.querySelectorAll('.panel-sticky button')].find((x) => x.textContent.includes('globe'))
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { w: Math.round(r.width), h: Math.round(r.height) }
})
ok('↑ globe is offered, at 44px', !!back && back.h >= 44 && back.w >= 44, JSON.stringify(back))
if (back) {
  await p.evaluate(() => [...document.querySelectorAll('.panel-sticky button')].find((x) => x.textContent.includes('globe')).click())
  // Back to the composed screen, not to the top of the scroller — the top is the pull-back exit.
  const home = await until((s) => s.top === s.rest)
  ok('↑ globe returns to the globe', home.top === home.rest, `scrollTop ${home.top}, rest ${home.rest}`)
  // The button unmounts under its own press; without focusing the sheet first, focus falls to <body>.
  ok('focus stays in the sheet', await p.evaluate(() => document.activeElement?.hasAttribute('data-sheet') === true),
    await p.evaluate(() => document.activeElement?.tagName ?? '?'))
}

// A spot page opens with the paper already up, and saved gets the same sheet.
await p.goto(base + '#/saved', { waitUntil: 'networkidle' }); await p.waitForTimeout(2600)
ok('saved scrolls the same way', await p.evaluate(() => { const el = document.querySelector('[data-sheet]'); if (!el) return false; el.scrollTop = 300; return el.scrollTop === 300 }))

// The way out: pulled all the way down and released, the city is left; released short of it, it is not.
await p.goto(base + '#/c/berkeley', { waitUntil: 'networkidle' }); await p.waitForTimeout(3000)
const swipe = async (from, to) => {
  await p.evaluate(async ({ from, to }) => {
    const el = document.querySelector('[data-sheet]')
    const T = (y) => new Touch({ identifier: 7, target: el, clientX: 195, clientY: y })
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [T(600)], changedTouches: [T(600)] }))
    for (let i = 1; i <= 12; i++) {
      el.scrollTop = from + (to - from) * (i / 12)
      el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [T(600 + i * 10)], changedTouches: [T(600 + i * 10)] }))
      await new Promise((r) => setTimeout(r, 16))
    }
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [T(600)] }))
  }, { from, to })
  await p.waitForTimeout(800)
}
const rest = await p.evaluate(() => document.querySelector('.sheet-exit').offsetHeight)
await swipe(rest, Math.round(rest * 0.7))
ok('a pull released short of the line stays in the city', (await p.evaluate(() => location.hash)).includes('berkeley'))
await p.evaluate(() => { document.querySelector('[data-sheet]').scrollTop = 900 })
await swipe(900, 300)
ok('a flick released down the page does not exit', (await p.evaluate(() => location.hash)).includes('berkeley'))
await p.evaluate(() => { const el = document.querySelector('[data-sheet]'); el.scrollTop = document.querySelector('.sheet-exit').offsetHeight })
await swipe(rest, 0)
ok('pulling all the way down returns to the sky', ['#/', ''].includes(await p.evaluate(() => location.hash)), await p.evaluate(() => location.hash))

ok('no page errors', errs.length === 0, errs.join(' | '))
console.log(errs.length ? `page errors: ${errs.join(' | ')}` : 'no page errors')
await b.close()
process.exit(failed ? 1 : 0)
