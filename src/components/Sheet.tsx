import { useEffect, useRef, useState, type ReactNode } from 'react'
import { actions } from '../store'

interface Props {
  children: ReactNode
  sticky?: ReactNode
  bare?: boolean
  /** Names the region, since it is something a screen reader can land on. */
  label: string
  /** Where the back word goes. */
  onBack: () => void
  /** What the back word says. */
  backWord: string
}

/** How long the page takes to slide away; matches the transition on `.sheet.is-leaving`. */
const LEAVE_MS = 260

/**
 * The mobile city page: the list, full screen, with one way back.
 *
 * It has been three other things. Three scroll-snap detents with a `show more` word, which was the only
 * thing that worked because the run-up was `pointer-events: none`. Then one long transparent run-up over
 * the globe, which made the list reachable by scrolling but spent most of the scroll on empty travel.
 * Then a pull-past-the-top gesture on top of that, which asked the scroll position to mean two things at
 * once — how much list you can see, and whether you are leaving — and felt unnatural for exactly that
 * reason: an invisible threshold on a gesture nobody had a reason to try.
 *
 * The scroll means one thing now. Tapping a city brings the list up over the globe and it stays up,
 * scrolling scrolls the list, and `← globe` goes back: always visible, always in the same place. The
 * motion that made the old sheet worth having survives as the entrance and the exit — the page rises out
 * of the horizon on the way in and goes back down on the way out — but it belongs to the app now instead
 * of being something the reader has to perform.
 */
export function Sheet({ children, sticky, bare = false, label, onBack, backWord }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [leaving, setLeaving] = useState(false)

  // The globe sits behind an opaque page the whole time this is up, so it may as well stop rendering.
  // This is what drives `covered` in App, which pauses the engine and takes the canvas out of the tab order.
  useEffect(() => {
    actions.setSheetProgress(1)
    return () => actions.setSheetProgress(0)
  }, [])

  const back = () => {
    if (leaving) return
    // Let the page go down first and change mode behind it, so nothing is deleted while it is on screen.
    if (document.documentElement.dataset.still !== undefined) onBack()
    else { setLeaving(true); window.setTimeout(onBack, LEAVE_MS) }
  }

  return (
    <div className={`sheet${leaving ? ' is-leaving' : ''}`} ref={ref} data-sheet tabIndex={-1} role="region" aria-label={label}>
      <section className="panel" aria-label="Details">
        <div className="panel-sticky">
          <button type="button" className="word word--quiet back-word" onClick={back}>{backWord}</button>
          {!bare && sticky}
        </div>
        <div className="column">{children}</div>
      </section>
    </div>
  )
}
