import { useState } from 'react'
import { actions, getState } from '../store'
import { hashFor } from '../lib/router'

export function shareUrl(): string {
  return `${location.origin}${location.pathname}${hashFor(getState())}`
}

/** `share` copies a deep link; on phones it hands to the share sheet (spec §6.15). */
export function ShareWord({ title }: { title: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'fallback'>('idle')
  const url = shareUrl()
  const go = async () => {
    const nav = navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> }
    try {
      if (typeof nav.share === 'function' && matchMedia('(pointer: coarse)').matches) { await nav.share({ title, url }); return }
      await navigator.clipboard.writeText(url)
      setState('copied'); actions.note('link copied')
      window.setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('fallback')
    }
  }
  return (
    <>
      <button type="button" className={`word${state === 'copied' ? ' moss' : ''}`} onClick={go}>{state === 'copied' ? 'copied' : 'share'}</button>
      {state === 'fallback' && <input className="search mono" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Link to this spot" />}
    </>
  )
}
