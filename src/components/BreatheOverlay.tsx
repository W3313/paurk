import { useEffect, useRef, useState } from 'react'

/** A native dialog: one minute of breathing on the shared 8 s cycle (spec §6.17). */
export function BreatheOverlay({ name, open, onClose, still }: { name: string; open: boolean; onClose: () => void; still: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [t, setT] = useState(0)
  const [cue, setCue] = useState('in')
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  useEffect(() => {
    if (!open) return
    const t0 = performance.now()
    const id = window.setInterval(() => {
      const s = (performance.now() - t0) / 1000
      setT(s)
      setCue(Math.floor(s / 4) % 2 === 0 ? 'in' : 'out')
      if (s >= 60) { setCue("that's one minute"); window.clearInterval(id); window.setTimeout(onClose, 2500) }
    }, 250)
    return () => window.clearInterval(id)
  }, [open, onClose])
  return (
    <dialog ref={ref} className="breathe-dialog" onClose={onClose} onClick={onClose} aria-label={`Breathe here: ${name}`}>
      <div className="breathe" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'grid', gap: 24, justifyItems: 'center' }}>
          <p className="display" style={{ fontSize: 'var(--t-display-l)' }}>{name}</p>
          {!still && <svg className="ring" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="64" /></svg>}
          <p className="cue" aria-live="polite">{cue}</p>
        </div>
        <button type="button" className="word dialog-close" onClick={onClose}>close</button>
        <div className="progress" style={{ width: `${Math.min(100, (t / 60) * 100)}%` }} />
      </div>
    </dialog>
  )
}
