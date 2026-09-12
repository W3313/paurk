import { actions, useStore } from '../store'

interface Props { onSearch: () => void; onAbout: () => void; scrolled?: boolean }

export function Header({ onSearch, onAbout, scrolled }: Props) {
  const saved = useStore((s) => s.savedIds.length)
  const mode = useStore((s) => s.mode)
  return (
    <header className={`header${scrolled ? ' is-scrolled' : ''}`}>
      <a className="wordmark" href="#/" onClick={(e) => { e.preventDefault(); actions.sky() }} aria-label="Paurk, back to the sky">
        {mode === 'sky' ? <h1 className="wordmark" style={{ display: 'inline' }}>Paurk</h1> : 'Paurk'}
      </a>
      <nav className="words" aria-label="Main">
        <button type="button" className="word word--quiet find-trigger" onClick={onSearch}
          aria-haspopup="dialog">find somewhere</button>
        <a className={`word word--quiet${mode === 'saved' ? ' is-on' : ''}`} href="#/saved" onClick={(e) => { e.preventDefault(); actions.setMode('saved') }}>
          saved{saved > 0 && <span className="mono"> · {saved}</span>}
        </a>
        <button type="button" className="word word--quiet only-desktop" onClick={onAbout}>about</button>
      </nav>
    </header>
  )
}
