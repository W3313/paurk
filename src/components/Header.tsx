import { actions, useStore } from '../store'

interface Props { onChooseCity: () => void; onAbout: () => void; scrolled?: boolean }

export function Header({ onChooseCity, onAbout, scrolled }: Props) {
  const saved = useStore((s) => s.savedIds.length)
  const mode = useStore((s) => s.mode)
  return (
    <header className={`header${scrolled ? ' is-scrolled' : ''}`}>
      <a className="wordmark" href="#/" onClick={(e) => { e.preventDefault(); actions.sky() }} aria-label="Paurk, back to the sky">
        {mode === 'sky' ? <h1 className="wordmark" style={{ display: 'inline' }}>Paurk</h1> : 'Paurk'}
      </a>
      <nav className="words" aria-label="Main">
        <button type="button" className="word word--quiet" onClick={onChooseCity}>choose a city</button>
        <a className={`word word--quiet${mode === 'stones' ? ' is-on' : ''}`} href="#/stones" onClick={(e) => { e.preventDefault(); actions.setMode('stones') }}>
          stones{saved > 0 && <span className="mono"> · {saved}</span>}
        </a>
        <button type="button" className="word word--quiet only-desktop" onClick={onAbout}>about</button>
      </nav>
    </header>
  )
}
