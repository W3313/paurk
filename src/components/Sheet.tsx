import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { actions, useStore } from '../store'
import { getGlobe } from '../globe/handle'

interface Props {
  children: ReactNode
  sticky?: ReactNode
  fullOnMount: boolean
  bare?: boolean
  /** Names the scroll region, since it is now something a screen reader can land on. */
  label: string
  /** Where pulling the sheet all the way down goes. */
  onPullBack: () => void
  /** The word for that place, shown as the pull passes the point of no return. */
  backWord: string
}

/**
 * The mobile sheet: a pull-back zone, a transparent run-up, then the paper (spec §3.3).
 *
 * It used to be three scroll-snap detents with a "show more" word to step between them — which was the
 * only thing that worked, because the run-up was pointer-events: none and a drag over it reached the
 * globe instead. The run-up is the scroll surface now, so the list is simply below the fold.
 *
 * Above the run-up sits an equally transparent pull-back zone. The sheet opens scrolled past it, so the
 * screen is composed exactly as before, and dragging the list all the way down scrolls into it and then
 * off the top, which returns you to the sky. Done with the scroller rather than a gesture recogniser
 * because the run-up already spends `touch-action: pan-y` on letting the browser own vertical drags —
 * there is no pointer stream left to read a pull out of — and because momentum, rubber-banding and the
 * interrupted half-pull all come free when the browser is the one doing the scrolling.
 */
export function Sheet({ children, sticky, fullOnMount, bare = false, label, onPullBack, backWord }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLElement>(null)
  const exit = useRef<HTMLDivElement>(null)
  const progress = useStore((s) => s.sheetProgress)
  /** The run-up's height and the pull-back zone's, as the stylesheet actually laid them out. */
  const run = useRef(1)
  const back = useRef(1)
  /** Guards the dismiss until the sheet has been positioned, or opening one would close it. */
  const armed = useRef(false)
  /** Whether a finger is down, which is what separates a deliberate pull from momentum passing through. */
  const held = useRef(false)
  const smooth = () => (document.documentElement.dataset.still !== undefined ? 'auto' : 'smooth') as ScrollBehavior

  // Before paint, not after: the sheet has to open already scrolled past the pull-back zone, or the
  // screen arrives at the wrong composition and then jumps.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    back.current = Math.max(1, exit.current?.offsetHeight ?? 0)
    el.scrollTop = back.current
    armed.current = true
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    // .sheet is fixed, so it is the panel's offsetParent. Measured rather than hardcoded, so neither
    // number can drift from the CSS. The guard degrades to a fraction if anyone ever makes .sheet
    // static, instead of dividing by zero and pinning progress at 1.
    const measure = () => {
      back.current = Math.max(1, exit.current?.offsetHeight ?? 0)
      const t = (panel.current?.offsetTop ?? 0) - back.current
      run.current = t > 8 ? t : el.clientHeight * 0.72
    }
    const write = () => {
      const past = el.scrollTop - back.current
      actions.setSheetProgress(Math.max(0, Math.min(1, past / run.current)))
      // 0 at rest, 1 with the zone fully pulled through. On the root rather than on this element, so it
      // reaches the city's caption too — that lives in <main>, a sibling of the sheet, and a custom
      // property only inherits downward. Written straight to the style, not through state: this runs on
      // every scroll frame and React has no business re-rendering the sheet for it.
      const p = Math.max(0, Math.min(1, -past / back.current))
      document.documentElement.style.setProperty('--pull', String(p))
    }
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(write) }
    /*
     * The decision is taken when the finger lifts, not while the scroller is moving. A flick from deep in
     * the list carries a long way under momentum, and committing on position alone turned every such
     * flick into an exit. Judged at release, that flick lets go somewhere down the page and nothing
     * happens; a pull that is actually held down to the top is unmistakable. Short of the line, the sheet
     * settles back to the composed screen rather than resting halfway through the zone.
     */
    const down = () => { held.current = true }
    const up = () => {
      if (!held.current) return
      held.current = false
      if (!armed.current) return
      if (el.scrollTop <= back.current * 0.4) { armed.current = false; onPullBack() }
      else if (el.scrollTop < back.current) el.scrollTo({ top: back.current, behavior: smooth() })
    }
    measure(); write()
    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('touchstart', down, { passive: true })
    el.addEventListener('touchend', up, { passive: true })
    el.addEventListener('touchcancel', up, { passive: true })
    const ro = new ResizeObserver(() => { measure(); write() })
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('touchstart', down)
      el.removeEventListener('touchend', up)
      el.removeEventListener('touchcancel', up)
      ro.disconnect(); cancelAnimationFrame(raf)
      document.documentElement.style.removeProperty('--pull')
    }
  }, [onPullBack])

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
    // The composed screen, not the top of the scroller — the top is the way out.
    el.scrollTo({ top: back.current, behavior: smooth() })
  }

  /*
   * The transparent zones lie over the sphere, so the two gestures have to be told apart.
   * `touch-action: pan-y` on them leaves vertical panning to the browser — which scrolls this sheet,
   * their own scroll container — and hands everything else to script, so what arrives here is a sideways
   * drag or a pinch: turn the globe. A tap that barely moved is a tap on the globe, and picks a city.
   */
  const turn = useRef<{ id: number; x: number; y: number; moved: number } | null>(null)
  const sky = {
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
      <div className="sheet-exit" ref={exit} aria-hidden="true" {...sky}>
        {/* Only once the pull is underway, so the resting screen stays as quiet as it was. */}
        <span className="sheet-back mono">{backWord}</span>
      </div>
      <div className="sheet-lead" aria-hidden="true" {...sky} />
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
