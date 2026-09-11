import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8')

/** Pulls `--token: value;` pairs out of the first rule whose selector matches. */
function tokensOf(selector: string): Record<string, string> {
  const i = css.indexOf(selector)
  expect(i, `selector not found: ${selector}`).toBeGreaterThan(-1)
  const body = css.slice(css.indexOf('{', i) + 1, css.indexOf('\n}', i))
  const out: Record<string, string> = {}
  for (const [, k, v] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[k] = v.trim()
  return out
}

describe('themes', () => {
  it('paints dark-scheme visitors before JavaScript runs', () => {
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)/)
    expect(css).toMatch(/:root:not\(\[data-theme="paper"\]\)/)
  })
  it('keeps the two copies of the slate palette identical', () => {
    const explicit = tokensOf(':root[data-theme="slate"]')
    const byScheme = tokensOf(':root:not([data-theme="paper"])')
    expect(Object.keys(explicit).length).toBeGreaterThan(15)
    expect(byScheme).toEqual(explicit)
  })
  it('still defines the paper palette on bare :root', () => {
    const paper = tokensOf(':root {')
    expect(paper['--bg']).toBe('#F4F1EA')
    expect(paper['--ink']).toBe('#23231F')
  })
})
