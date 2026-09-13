import { useEffect, useRef, type ReactNode } from 'react'
import { actions, useStore } from '../store'
import { getGlobe } from '../globe/handle'

interface Props {
  children: ReactNode
  sticky?: ReactNode
  fullOnMount: boolean
  bare?: boolean
  /** Names the scroll region, since it is now something a screen reader can land on. */
  label: string
}

/**
 * The mobile sheet: one plain scroller, a transparent run-up, then the paper (spec §3.3).
 *
 * It used to be three scroll-snap detents with a "show more" word to step between them — which was the
 * only thing that worked, because the run-up was pointer-events: none and a drag over it reached the
 * globe instead. The run-up is the scroll surface now, so the list is simply below the fold.
 */
export function Sheet({ children, sticky, fullOnMount, bare = false, label }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLElement>(null)
  const progress = useStore((s) => s.sheetProgress)
  /** The run-up's height, as the stylesheet actually laid it out. */
  const run = useRef(1)
  const smooth = () => (document.documentElement.dataset.still !== undefined ? 'auto' : 'smooth') as ScrollBehavior

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    // .sheet is fixed, so it is the panel's offsetParent and offsetTop is exactly the run-up. Measured
    // rather than hardcoded, so progress cannot drift from the CSS. The guard degrades to a fraction if
    // anyone ever makes .sheet static, instead of dividing by zero and pinning progress at 1.
    const measure = () => { const t = panel.current?.offsetTop ?? 0; run.current = t > 8 ? t : el.clientHeight * 0.72 }
    const write = () => actions.setSheetProgress(Math.max(0, Math.min(1, el.scrollTop / run.current)))
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(write) }
    measure(); write()
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(() => { measure(); write() })
    ro.observe(el)
    return () => { el.removeEventListener('scroll', onScroll); ro.disconnect(); cancelAnimationFrame(raf) }
  }, [])

  useEffect(() => {
    if (!fullOnMount) return
    ref.current?.scrollTo({ top: panel.current?.offsetTop ?? 0, behavior: smooth() })
  }, [fullOnMount])
  useEffect(() => () => actions.setSheetProgress(0), [])

  // Focus first, scroll second: this button unmounts under its own press once progress drops, and
  // without this the focus it was holding falls to <body> and the next Tab restarts at the page top.
  const toGlobe = () => {
    const el = ref.current
    if (!el) return
    el.focus({ preventScroll: true })
    el.scrollTo({ top: 0, behavior: smooth() })
  }

  /*
   * The lead lies over the sphere, so the two gestures have to be told apart. `touch-action: pan-y` on it
   * leaves vertical panning to the browser — which scrolls this sheet, the lead's own scroll container —
   * and hands everything else to script, so what arrives here is a sideways drag or a pinch: turn the
   * globe. A tap that barely moved is a tap on the globe, and picks a city.
   */
  const turn = useRef<{ id: number; x: number; y: number; moved: number } | null>(null)
  const lead = {
    onPointerDown: (e: React.PointerEvent) => {
      if (!getGlobe()) return
      turn.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove: (e: React.PointerEvent) => {
      const t = turn.current
      if (!t || t.id !== e.pointerId) return
      const dx = e.clientX - t.x, dy = e.clientY - t.y
      t.moved += Math.abs(dx) + Math.abs(dy)
      t.x = e.clientX; t.y = e.clientY
      getGlobe()?.turnBy(dx, dy)
    },
    onPointerUp: (e: React.PointerEvent) => {
      const t = turn.current
      turn.current = null
      if (!t || t.id !== e.pointerId) return
      if (t.moved < 8) getGlobe()?.tapAt(e.clientX, e.clientY)
    },
    // A vertical drag becomes a native scroll, and the browser takes the pointer back mid-gesture.
    onPointerCancel: () => { turn.current = null },
  }

  return (
    <div className="sheet" ref={ref} data-sheet tabIndex={0} role="region" aria-label={label}>
      <div className="sheet-lead" aria-hidden="true" {...lead} />
      <section className="panel" ref={panel} aria-label="Details">
        {!bare && (
          <div className="panel-sticky">
            {sticky}
            {progress > 0.5 && (
              <button type="button" className="word word--quiet word--small" onClick={toGlobe}>↑ globe</button>
            )}
          </div>
        )}
        <div className="column">{children}</div>
      </section>
    </div>
  )
}
