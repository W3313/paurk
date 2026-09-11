import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * A render error used to blank the page. Now it shows the app's own voice and two ways out:
 * back to the sky (which resets the route), or a reload that also clears saved state if that is
 * what broke. Nothing is reported anywhere; there is no backend.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('TrueChiller crashed:', error, info.componentStack)
  }

  private backToSky = () => {
    location.hash = '#/'
    this.setState({ error: null })
  }

  private reset = () => {
    try {
      localStorage.removeItem('tc.photos.v1')
      localStorage.removeItem('tc.saved.v1')
    } catch {
      /* storage unavailable */
    }
    location.hash = '#/'
    location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="crash" role="alert">
        <p className="display" style={{ fontSize: 'var(--t-display-l)' }}>Something stopped.</p>
        <p className="note">That is on us, not on you. The places are all still there.</p>
        <div className="words">
          <button type="button" className="word" onClick={this.backToSky}>back to the sky</button>
          <button type="button" className="word word--quiet" onClick={this.reset}>reload and clear what is saved</button>
        </div>
        <p className="mono" style={{ color: 'var(--ink-2)' }}>{this.state.error.message.slice(0, 160)}</p>
      </main>
    )
  }
}
