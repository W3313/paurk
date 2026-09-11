import { useEffect } from 'react'
import { actions } from '../store'

export function useOnlineWatcher() {
  useEffect(() => {
    const on = () => actions.setOnline(true)
    const off = () => { actions.setOnline(false); actions.note('offline · showing what we have') }
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
}
