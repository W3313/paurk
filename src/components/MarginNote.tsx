import { useEffect, useRef, useState } from 'react'
import { actions, useStore } from '../store'

/** The app's one voice: hint, toast and live region (spec §6.13). One line per 1.2 s, duplicates dropped. */
export function MarginNote({ fallback, className = '' }: { fallback?: string; className?: string }) {
  const queue = useStore((s) => s.notes)
  const [line, setLine] = useState<string | null>(null)
  const [key, setKey] = useState(0)
  const busy = useRef(false)
  const last = useRef<string | null>(null)

  useEffect(() => {
    if (busy.current || !queue.length) return
    const next = queue[0]
    actions.shiftNote()
    if (next === last.current) return
    last.current = next
    setLine(next)
    setKey((k) => k + 1)
    busy.current = true
    const t = window.setTimeout(() => { busy.current = false; if (queue.length > 1) setKey((k) => k + 1) }, 1200)
    return () => window.clearTimeout(t)
  }, [queue, key])

  useEffect(() => {
    if (!line) return
    const t = window.setTimeout(() => setLine(null), 6000)
    return () => window.clearTimeout(t)
  }, [line, key])

  const text = line ?? fallback ?? ''
  return (
    <p className={`note ${className}`} role="status" aria-live="polite" aria-atomic="true">
      {text && <span className="line" key={key}>{text}</span>}
    </p>
  )
}
