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
          aria-haspopup="dialog" aria-label="Find a city or a place" title="Find a city or a place">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor"
            strokeWidth="1.4" strokeLinecap="round" aria-hidden="true" focusable="false">
            <circle cx="8.5" cy="8.5" r="5.4" />
            <path d="M12.7 12.7 17 17" />
          </svg>
        </button>
        <a className={`word word--quiet${mode === 'saved' ? ' is-on' : ''}`} href="#/saved" onClick={(e) => { e.preventDefault(); actions.setMode('saved') }}>
          saved{saved > 0 && <span className="mono"> · {saved}</span>}
        </a>
        <button type="button" className="word word--quiet only-desktop" onClick={onAbout}>about</button>
      </nav>
    </header>
  )
}
