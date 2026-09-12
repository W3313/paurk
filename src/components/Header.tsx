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
        <button type="button" className="word word--quiet mark find-trigger" onClick={onSearch}
          aria-haspopup="dialog" aria-label="Find a city or a place" title="Find a city or a place">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor"
            strokeWidth="1.4" strokeLinecap="round" aria-hidden="true" focusable="false">
            <circle cx="8.5" cy="8.5" r="5.4" />
            <path d="M12.7 12.7 17 17" />
          </svg>
        </button>
        <a className={`word word--quiet mark saved-trigger${mode === 'saved' ? ' is-here' : ''}`} href="#/saved"
          onClick={(e) => { e.preventDefault(); actions.setMode('saved') }}
          aria-current={mode === 'saved' ? 'page' : undefined}
          aria-label={saved > 0 ? `Saved, ${saved} ${saved === 1 ? 'spot' : 'spots'}` : 'Saved'} title="Saved">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor"
            strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M5.6 3.4h8.8a1 1 0 0 1 1 1v12a.6.6 0 0 1-.9.52L10 14.2l-4.5 2.72a.6.6 0 0 1-.9-.52v-12a1 1 0 0 1 1-1z" />
          </svg>
          {saved > 0 && <span className="mono" aria-hidden="true">{saved}</span>}
        </a>
        <button type="button" className="word word--quiet only-desktop" onClick={onAbout}>about</button>
      </nav>
    </header>
  )
}
