// Re-downloads the self-hosted latin subsets of all three families into public/fonts/ and prints the
// @font-face rules to paste at the top of src/styles/app.css. Run this only when a family changes.
//
// All three, not just the body face. The two display families used to come from a render-blocking
// fonts.googleapis.com stylesheet — the only third-party resource on the render path — and when that host
// is unreachable the browser waits out the timeout with nothing painted at all: no wordmark, no city
// list, not even the noscript text. Measured on the built app at 390x844, first paint went from 12596ms
// to 48ms with that one request removed. Self-hosting also means the CSP no longer has to allow a second
// origin, which makes the About page's claim about nothing leaving the device structurally true.
import { writeFileSync, mkdirSync } from 'node:fs'

const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'
const WANT = new Set(['latin', 'latin-ext'])
const FAMILIES = [
  { query: 'Zen+Kaku+Gothic+New:wght@300;400;500', family: 'Zen Kaku Gothic New', slug: 'zen-kaku' },
  { query: 'Cormorant+Garamond:ital,wght@0,300;0,400;1,300', family: 'Cormorant Garamond', slug: 'cormorant' },
  { query: 'DM+Mono:wght@300;400', family: 'DM Mono', slug: 'dm-mono' },
]

mkdirSync('public/fonts', { recursive: true })
const rules = []
for (const { query, family, slug } of FAMILIES) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${query}&display=swap`, { headers: { 'User-Agent': UA } })).text()
  for (const [, subset, body] of css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([^}]*)\}/g)) {
    if (!WANT.has(subset)) continue
    const weight = body.match(/font-weight:\s*(\d+)/)?.[1]
    const style = body.match(/font-style:\s*(\w+)/)?.[1] ?? 'normal'
    const url = body.match(/url\((https:[^)]+)\)/)?.[1]
    const range = body.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim()
    if (!weight || !url || !range) continue
    const file = `${slug}-${weight}${style === 'italic' ? '-italic' : ''}-${subset}.woff2`
    writeFileSync(`public/fonts/${file}`, Buffer.from(await (await fetch(url)).arrayBuffer()))
    rules.push(`@font-face {\n  font-family: '${family}';\n  font-style: ${style};\n  font-weight: ${weight};\n  font-display: swap;\n  src: url('/fonts/${file}') format('woff2');\n  unicode-range: ${range};\n}`)
    console.log('wrote public/fonts/' + file)
  }
}
writeFileSync('/tmp/font-face-rules.css', rules.join('\n') + '\n')
console.log(`\n${rules.length} rules written to /tmp/font-face-rules.css`)
