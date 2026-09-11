import { useEffect, useRef } from 'react'
import { actions, useStore } from '../store'
import { cities, spots } from '../data'

interface Props { open: boolean; onClose: () => void }

export function AboutDialog({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const still = useStore((s) => s.still)
  const units = useStore((s) => s.units)
  const theme = useStore((s) => s.theme)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  const slate = theme === 'slate' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
  return (
    <dialog ref={ref} onClose={onClose} aria-label="About TrueChiller" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="dialog dialog--about about">
        <button type="button" className="word word--quiet dialog-close" onClick={onClose}>close</button>
        <p className="display" style={{ fontSize: 'var(--t-display-m)', fontStyle: 'italic', color: 'var(--ink-2)' }}>TrueChiller</p>
        <p>Somewhere to breathe, wherever, whenever. {spots.length} low-key places in {cities.length} cities, gathered from what locals recommend online and checked one by one.</p>
        <p>We only list public places. Caution notes are about lighting and company after dark, not about crime statistics. Check hours locally; things change.</p>
        <p>Your location is looked at once, on this device, only when you ask. Nothing leaves it. Saved stones live in this browser.</p>
        <p className="small">Photographs come from Wikimedia Commons under their own licences; when there is none, a poster is drawn from the spot's notes. Sun times are computed here; weather, when shown, is from Open-Meteo.</p>
        <div className="words" style={{ gap: '10px 24px' }}>
          <button type="button" className="word" aria-pressed={still} onClick={() => actions.setStill(!still)}>{still ? 'still · on' : 'still'}</button>
          <button type="button" className="word" onClick={() => actions.setUnits(units === 'metric' ? 'imperial' : 'metric')}>{units === 'metric' ? 'km' : 'mi'}</button>
          <button type="button" className="word" onClick={() => actions.setTheme(slate ? 'paper' : 'slate')}>{slate ? 'lights up' : 'lights down'}</button>
          {theme !== 'auto' && <button type="button" className="word word--quiet" onClick={() => actions.setTheme('auto')}>follow the system</button>}
        </div>
        <p className="small">Keyboard: on the globe, arrows turn it, plus and minus zoom, page down and page up step between cities, Enter opens one, Escape returns to the sky.</p>
      </div>
    </dialog>
  )
}
