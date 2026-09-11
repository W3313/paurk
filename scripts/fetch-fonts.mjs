// Re-downloads the self-hosted Zen Kaku Gothic New latin subsets into public/fonts/ and prints the
// @font-face rules to paste at the top of src/styles/app.css. Run this only when the family changes.
import { writeFileSync, mkdirSync } from 'node:fs'

const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'
const WANT = new Set(['latin', 'latin-ext'])
const css = await (await fetch('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@300;400;500&display=swap', { headers: { 'User-Agent': UA } })).text()

mkdirSync('public/fonts', { recursive: true })
const rules = []
for (const [, subset, body] of css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([^}]*)\}/g)) {
  if (!WANT.has(subset)) continue
  const weight = body.match(/font-weight:\s*(\d+)/)?.[1]
  const url = body.match(/url\((https:[^)]+)\)/)?.[1]
  const range = body.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim()
  if (!weight || !url || !range) continue
  const file = `zen-kaku-${weight}-${subset}.woff2`
  writeFileSync(`public/fonts/${file}`, Buffer.from(await (await fetch(url)).arrayBuffer()))
  rules.push(`@font-face {\n  font-family: 'Zen Kaku Gothic New';\n  font-style: normal;\n  font-weight: ${weight};\n  font-display: swap;\n  src: url('/fonts/${file}') format('woff2');\n  unicode-range: ${range};\n}`)
  console.log('wrote public/fonts/' + file)
}
console.log('\n' + rules.join('\n'))
