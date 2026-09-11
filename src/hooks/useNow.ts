import { useEffect, useState } from 'react'

/** The live clock, ticking on the minute. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let id = 0
    const arm = () => { id = window.setTimeout(() => { setNow(new Date()); arm() }, 60000 - (Date.now() % 60000) + 50) }
    arm()
    return () => window.clearTimeout(id)
  }, [])
  return now
}
