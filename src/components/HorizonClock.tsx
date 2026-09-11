import { useEffect, useRef } from 'react'
import type { Period, SunInfo } from '../lib/time'
import { HORIZON_TOKEN, horizonHeight } from '../lib/phase'
import { useStore } from '../store'
import { getGlobe } from '../globe/handle'

interface Props { sun: SunInfo | null; mobile: boolean }

function parseRgba(s: string): [number, number, number, number] | null {
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.%]+))?\s*\)/)
  if (!m) return null
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4])
  return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255, a]
}

/** Headless: drives --horizon, --horizon-h, --golden, --breath, the theme and stillness attributes, and mirrors the horizon to the globe (spec §2.7, §7.4). */
export function HorizonClock({ sun, mobile }: Props) {
  const theme = useStore((s) => s.theme)
  const still = useStore((s) => s.still)
  const ambient = useStore((s) => s.ambient)
  const preview = useStore((s) => s.previewMinutes)
  const lastPeriod = useRef<Period | null>(null)

  // Theme is decided at load (or by the user); never flipped by the clock.
  useEffect(() => {
    const root = document.documentElement
    const dark = theme === 'slate' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
    root.dataset.theme = dark ? 'slate' : 'paper'
  }, [theme])
  useEffect(() => { const r = document.documentElement; if (still) r.dataset.still = ''; else delete r.dataset.still }, [still])
  useEffect(() => { const r = document.documentElement; if (ambient) r.dataset.ambient = ''; else delete r.dataset.ambient }, [ambient])

  // Horizon colour and height follow the period; scrubbing shortens the transition.
  useEffect(() => {
    const root = document.documentElement
    const period = sun?.period ?? 'midday'
    const css = getComputedStyle(root)
    const token = HORIZON_TOKEN[period].replace(/var\((--[^)]+)\)/, '$1')
    const value = css.getPropertyValue(token).trim() || 'rgba(220,220,214,.2)'
    root.style.setProperty('--horizon', value)
    root.style.setProperty('--horizon-h', horizonHeight(period, mobile))
    const golden = period === 'golden' && sun?.minutesToSunset !== null && sun?.minutesToSunset !== undefined ? Math.max(0, Math.min(1, 1 - sun.minutesToSunset / 90)) : 0
    root.style.setProperty('--golden', golden.toFixed(3))
    lastPeriod.current = period
  }, [sun, mobile, theme])

  useEffect(() => {
    const root = document.documentElement
    if (preview === null) { delete root.dataset.scrub; return }
    root.dataset.scrub = ''
    const t = window.setTimeout(() => { delete root.dataset.scrub }, 600)
    return () => window.clearTimeout(t)
  }, [preview])

  // Shared breath clock at 30fps; mirror the (transitioning) horizon colour to the sphere once a second.
  useEffect(() => {
    const root = document.documentElement
    let raf = 0, last = 0, lastMirror = 0, lastValue = ''
    const supportsRegistered = typeof CSS !== 'undefined' && 'registerProperty' in CSS
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (now - last < 33) return
      last = now
      if (!still) root.style.setProperty('--breath', (0.5 - 0.5 * Math.cos((now * 2 * Math.PI) / 8000)).toFixed(3))
      if (now - lastMirror > 1000) {
        lastMirror = now
        const v = getComputedStyle(root).getPropertyValue('--horizon').trim()
        if (v && v !== lastValue) {
          lastValue = v
          const c = parseRgba(v)
          if (c) getGlobe()?.setHorizon(c[0], c[1], c[2], c[3])
        }
      }
    }
    if (still) root.style.setProperty('--breath', '0')
    raf = requestAnimationFrame(tick)
    if (!supportsRegistered) root.style.setProperty('transition', 'none')
    return () => cancelAnimationFrame(raf)
  }, [still])
  return null
}
