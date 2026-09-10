import { useEffect, useState } from 'react'
import { useStore } from '../store'

/** Current time, ticking once a minute (or the user's time override). */
export function useNow(): Date {
  const override = useStore((s) => s.timeOverride)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(id)
  }, [])
  return override ?? now
}
