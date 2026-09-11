import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SunRule, instantAtLocalMinutes, localMinutes, type SunRuleProps } from '../components/SunRule'

const LISBON = { cityName: 'Lisbon', timeZone: 'Europe/Lisbon', lat: 38.72, lng: -9.14 }
const NOW = new Date('2026-09-10T18:30:00Z') // 19:30 in Lisbon (WEST)
const PERIODS = '(night|first light|morning|midday|afternoon|golden hour|blue hour)'

const render = (props: Partial<SunRuleProps>) =>
  renderToStaticMarkup(createElement(SunRule, { ...LISBON, now: NOW, previewMinutes: null, onPreview: () => {}, ...props }))

describe('SunRule', () => {
  it('renders a labelled range whose value text carries the time and period', () => {
    const html = render({})
    expect(html).toContain('<input type="range"')
    expect(html).toContain('aria-label="Time of day in Lisbon"')
    expect(html).toMatch(new RegExp(`aria-valuetext="\\d{2}:\\d{2}, ${PERIODS}"`))
    expect(html).toContain('aria-valuetext="19:30, golden hour"')
    expect(html).toContain('value="1170"')
  })

  it('labels sunrise and sunset as HH:MM mono text and draws a filled sun while live', () => {
    const html = render({})
    const labels = [...html.matchAll(/<text class="sunrule-label"[^>]*>(\d{2}:\d{2})<\/text>/g)].map((m) => m[1])
    expect(labels).toHaveLength(2)
    expect(labels[0]).toMatch(/^0[67]:\d{2}$/) // Lisbon sunrise in September
    expect(labels[1]).toMatch(/^19:\d{2}$/) // and sunset
    expect(html).toContain('class="sunrule-sun"')
    expect(html).not.toContain('class="sunrule-moon"')
    expect(html).not.toContain('sunrule-now') // no separate now-tick while live
    expect(html).not.toContain('>now</button>')
  })

  it('previewing 23:00 draws the hollow moon, the now tick and the now/pin words', () => {
    const html = render({ previewMinutes: 1380, onPin: () => {} })
    expect(html).toMatch(/<circle class="sunrule-moon"[^>]*fill="none"/)
    expect(html).toContain('aria-valuetext="23:00, night"')
    expect(html).toContain('class="sunrule-now"')
    expect(html).toContain('>now</button>')
    expect(html).toContain('>pin</button>')
    expect(render({ previewMinutes: 1380, onPin: () => {}, pinned: true })).toContain('>pinned</button>')
  })

  it('prints the polar sentence instead of ticks but keeps the range', () => {
    const svalbard = { cityName: 'Longyearbyen', timeZone: 'Arctic/Longyearbyen', lat: 78.2, lng: 15.6 }
    const summer = render({ ...svalbard, now: new Date('2026-06-21T12:00:00Z') })
    const says = (verb: string) => new RegExp(`the sun doesn(?:'|&#x27;|&#39;)t ${verb} here today`) // React escapes the apostrophe
    expect(summer).toMatch(says('set'))
    expect(summer).toContain('<input type="range"')
    expect(summer).not.toContain('sunrule-tick')
    expect(render({ ...svalbard, now: new Date('2026-12-21T12:00:00Z') })).toMatch(says('rise'))
  })

  it('maps minutes and instants through the city zone, not the host zone', () => {
    expect(localMinutes(NOW, 'Europe/Lisbon')).toBe(19 * 60 + 30)
    expect(localMinutes(NOW, 'Asia/Tokyo')).toBe(3 * 60 + 30) // next day, 03:30
    expect(instantAtLocalMinutes(NOW, 'Europe/Lisbon', 1380).toISOString()).toBe('2026-09-10T22:00:00.000Z')
    expect(instantAtLocalMinutes(NOW, 'Asia/Tokyo', 0).toISOString()).toBe('2026-09-10T15:00:00.000Z')
  })
})
