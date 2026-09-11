import { useId, type KeyboardEvent } from 'react'
import * as SunCalc from 'suncalc'
import { PERIOD_LABEL, sunInfo } from '../lib/time'

export interface SunRuleProps {
  cityName: string
  timeZone: string
  lat: number
  lng: number
  /** the live instant */
  now: Date
  /** minutes since local midnight being previewed, or null when live */
  previewMinutes: number | null
  onPreview: (minutes: number | null) => void
  onPin?: (minutes: number) => void
  pinned?: boolean
  className?: string
}

const W = 380, H = 44, LINE = 28, LAST = 1439, BAND_Y = 8, BAND_H = 20
const HOURS = Array.from({ length: 25 }, (_, h) => h)
const xOf = (m: number) => (Math.min(m, LAST) / LAST) * W
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
const valid = (d: Date | null): d is Date => d !== null && !Number.isNaN(d.getTime())

interface Wall { y: number; mo: number; d: number; h: number; mi: number; s: number }
/** Wall-clock parts of `date` in `tz` (falls back to the browser zone if `tz` is unknown). */
function wallParts(date: Date, tz: string): Wall {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).formatToParts(date)
    const get = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value ?? 0)
    return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour') % 24, mi: get('minute'), s: get('second') }
  } catch {
    return { y: date.getFullYear(), mo: date.getMonth() + 1, d: date.getDate(), h: date.getHours(), mi: date.getMinutes(), s: date.getSeconds() }
  }
}
const asUTC = (w: Wall) => Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s)
/** Minutes since local midnight of `date` in `tz`. */
export function localMinutes(date: Date, tz: string): number {
  const w = wallParts(date, tz)
  return w.h * 60 + w.mi
}
/** The instant that is `minutes` past local midnight on `base`'s local date in `tz`. */
export function instantAtLocalMinutes(base: Date, tz: string, minutes: number): Date {
  const w = wallParts(base, tz)
  const wanted = Date.UTC(w.y, w.mo - 1, w.d) + minutes * 60000 // wall time as if it were UTC
  const guess = wanted - (asUTC(w) - Math.floor(base.getTime() / 1000) * 1000) // apply base's offset
  const offset = asUTC(wallParts(new Date(guess), tz)) - guess // re-read the offset at the target (DST)
  return new Date(wanted - offset)
}

export function SunRule({ cityName, timeZone, lat, lng, now, previewMinutes, onPreview, onPin, pinned = false, className }: SunRuleProps) {
  const uid = useId().replace(/\W/g, '')
  const hatchId = `sunrule-hatch-${uid}`
  const previewing = previewMinutes !== null
  const nowMin = localMinutes(now, timeZone)
  const minutes = clamp(Math.round(previewMinutes ?? nowMin), 0, LAST)
  const instant = previewing ? instantAtLocalMinutes(now, timeZone, minutes) : now
  const info = sunInfo(instant, { lat, lng })
  const altitude = SunCalc.getPosition(instant, lat, lng).altitude
  const cx = xOf(minutes), cy = clamp(LINE - 16 * Math.sin(altitude), 6, 42)

  // Today's events for the city's local date, anchored at local noon so the figure is stable all day.
  const noon = instantAtLocalMinutes(now, timeZone, 720)
  const times = SunCalc.getTimes(noon, lat, lng)
  const at = (d: Date | null) => (valid(d) ? localMinutes(d, timeZone) : null)
  const sunrise = at(times.sunrise), sunset = at(times.sunset), golden = at(times.goldenHour)
  const dawn = at(times.dawn), dusk = at(times.dusk)
  const noonAltitude = SunCalc.getPosition(noon, lat, lng).altitude

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Home') { e.preventDefault(); onPreview(null); return }
    const arrow = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    const delta = e.key === 'PageUp' ? 60 : e.key === 'PageDown' ? -60 : e.shiftKey ? arrow * 15 : 0
    if (!delta) return // plain arrows: native ±1
    e.preventDefault()
    onPreview(clamp(minutes + delta, 0, LAST))
  }

  return (
    <div className={['sunrule', className].filter(Boolean).join(' ')}>
      <figure className="sunrule-figure">
        <svg className="sunrule-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
          {info.polar ? (
            <>
              <line className="sunrule-hairline" x1={0} x2={W} y1={LINE} y2={LINE} shapeRendering="crispEdges" />
              <text className="sunrule-polar" x={0} y={18}>
                {noonAltitude < 0 ? "the sun doesn't rise here today" : "the sun doesn't set here today"}
              </text>
            </>
          ) : (
            <>
              <defs>
                <pattern id={hatchId} width={4} height={H} patternUnits="userSpaceOnUse">
                  <rect className="sunrule-hatch" width={1} height={H} />
                </pattern>
              </defs>
              {dawn !== null && <rect x={0} y={BAND_Y} width={xOf(dawn)} height={BAND_H} fill={`url(#${hatchId})`} />}
              {dusk !== null && <rect x={xOf(dusk)} y={BAND_Y} width={W - xOf(dusk)} height={BAND_H} fill={`url(#${hatchId})`} />}
              {golden !== null && sunset !== null && golden < sunset && (
                <rect className="sunrule-golden" x={xOf(golden)} y={BAND_Y} width={xOf(sunset) - xOf(golden)} height={BAND_H} />
              )}
              <g shapeRendering="crispEdges">
                <line className="sunrule-hairline" x1={0} x2={W} y1={LINE} y2={LINE} />
                {HOURS.map((h) => (
                  <line key={h} className={h % 6 ? 'sunrule-tick' : 'sunrule-tick sunrule-tick--6h'} x1={xOf(h * 60)} x2={xOf(h * 60)} y1={LINE} y2={LINE + (h % 6 ? 2 : 5)} />
                ))}
                {[sunrise, sunset].map((m, i) => m !== null && (
                  <g key={i}>
                    <line className="sunrule-tick sunrule-tick--sun" x1={xOf(m)} x2={xOf(m)} y1={LINE - 4} y2={LINE} />
                    <text className="sunrule-label" x={xOf(m)} y={41} textAnchor="middle">{hhmm(m)}</text>
                  </g>
                ))}
                {previewing && <line className="sunrule-now" x1={xOf(nowMin)} x2={xOf(nowMin)} y1={LINE - 8} y2={LINE + 8} />}
              </g>
              {altitude < 0
                ? <circle className="sunrule-moon" cx={cx} cy={cy} r={5} fill="none" />
                : <circle className="sunrule-sun" cx={cx} cy={cy} r={5} />}
            </>
          )}
        </svg>
        <input
          type="range" className="sunrule-range" min={0} max={LAST} step={1} value={minutes}
          aria-label={`Time of day in ${cityName}`} aria-valuetext={`${hhmm(minutes)}, ${PERIOD_LABEL[info.period]}`}
          onChange={(e) => onPreview(Number(e.currentTarget.value))} onKeyDown={onKeyDown}
        />
      </figure>
      <div className="sunrule-words">
        {previewing && <button type="button" className="word" onClick={() => onPreview(null)}>now</button>}
        {previewing && onPin && (
          <button type="button" className="word" aria-pressed={pinned} onClick={() => onPin(minutes)}>{pinned ? 'pinned' : 'pin'}</button>
        )}
      </div>
    </div>
  )
}

/** Scoped styles; inject once into the global stylesheet. Only design tokens, no raw colours. */
export const SUNRULE_CSS = `
.sunrule { display: block; width: 100%; max-width: 380px; }
.sunrule-figure { position: relative; margin: 0; width: 100%; height: 44px; border-radius: var(--r-well, 6px);
  transition: background-color var(--d-micro, 240ms) var(--e-settle, cubic-bezier(.2,.8,.2,1)); }
.sunrule-figure:has(.sunrule-range:hover), .sunrule-figure:has(.sunrule-range:active) { background: var(--well); }
.sunrule-figure:has(.sunrule-range:focus-visible) { outline: 2px solid var(--ink); outline-offset: 2px; }
.sunrule-svg { display: block; width: 100%; height: 44px; overflow: visible; }
.sunrule-range { position: absolute; inset: 0; width: 100%; height: 44px; margin: 0; padding: 0; opacity: 0;
  cursor: ew-resize; appearance: none; -webkit-appearance: none; background: none; touch-action: pan-y; }
.sunrule-hairline, .sunrule-tick { stroke: var(--hairline); stroke-width: 1; }
.sunrule-tick--6h, .sunrule-tick--sun { stroke: var(--ink-2); }
.sunrule-now { stroke: var(--ink); stroke-width: 1; }
.sunrule-hatch { fill: var(--hairline); }
.sunrule-golden { fill: var(--h-golden); }
.sunrule-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: .02em; fill: var(--ink-2); }
.sunrule-polar { font-family: var(--font-mono); font-size: var(--t-mono); letter-spacing: .02em; fill: var(--ink-2); }
.sunrule-sun { fill: var(--accent); }
.sunrule-moon { fill: none; stroke: var(--accent); stroke-width: 1; }
.sunrule-words { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; min-height: 24px; margin-top: 8px; }
`
