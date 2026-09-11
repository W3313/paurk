import { useEffect, useRef, type ReactNode } from 'react'
import { actions, useStore } from '../store'

/** Mobile bottom sheet as a native scroll-snap container with three detents (spec §3.3). */
export function Sheet({ children, sticky, fullOnMount, bare = false }: { children: ReactNode; sticky?: ReactNode; fullOnMount: boolean; bare?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const progress = useStore((s) => s.sheetProgress)
  const detent = (n: 0 | 1 | 2) => {
    const el = ref.current
    if (!el) return
    const H = el.clientHeight
    const tops = [0, 0.37 * H, 0.76 * H]
    el.scrollTo({ top: tops[n], behavior: document.documentElement.dataset.still !== undefined ? 'auto' : 'smooth' })
  }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => actions.setSheetProgress(Math.max(0, Math.min(1, el.scrollTop / (0.76 * el.clientHeight)))))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])
  useEffect(() => { if (fullOnMount) detent(2) }, [fullOnMount])
  useEffect(() => () => actions.setSheetProgress(0), [])
  return (
    <div className="sheet" ref={ref} data-sheet>
      <div className="sheet-spacer" style={{ height: '37dvh' }} aria-hidden="true" />
      <div className="sheet-spacer" style={{ height: '39dvh' }} aria-hidden="true" />
      <div className="sheet-spacer" style={{ height: '6dvh' }} aria-hidden="true" />
      <section className="panel" aria-label="Details">
        {!bare && (
          <div className="panel-sticky">
            {sticky}
            <div className="words" style={{ justifyContent: 'flex-end' }}>
              {progress < 0.9 ? <button type="button" className="word word--quiet word--small" onClick={() => detent(2)}>show more</button> : <button type="button" className="word word--quiet word--small" onClick={() => detent(0)}>show less</button>}
            </div>
          </div>
        )}
        <div className="column">{children}</div>
      </section>
    </div>
  )
}

export function scrollSheetToPeek() {
  const el = document.querySelector<HTMLElement>('[data-sheet]')
  el?.scrollTo({ top: 0, behavior: 'smooth' })
}
