import { useEffect, useState } from 'react'
import type { Spot } from '../types'
import { fetchWikiPhoto, type Photo } from '../lib/photos'
import { SumiPoster } from './SumiPoster'

/** Poster first, photo when accepted (spec §6.12). */
export function SpotImage({ spot, cityName }: { spot: Spot; cityName: string }) {
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [original, setOriginal] = useState(false)
  useEffect(() => {
    let alive = true
    setPhoto(null); setLoaded(false); setOriginal(false)
    if (!spot.wikipediaTitle) return
    void fetchWikiPhoto(spot.wikipediaTitle, 800).then((p) => {
      if (!alive || !p) return
      const aspect = p.width / p.height
      if (p.width >= 640 && aspect >= 0.7 && aspect <= 2.2) setPhoto(p)
    })
    return () => { alive = false }
  }, [spot.id, spot.wikipediaTitle])
  return (
    <>
      <div className={`photo${photo && loaded ? ' has-photo' : ''}${original ? ' is-original' : ''}`}>
        <SumiPoster spot={spot} cityName={cityName} />
        {photo && (
          <img src={photo.src} width={photo.width} height={photo.height} alt={`${spot.name} — ${spot.wikipediaTitle}`} crossOrigin="anonymous" loading="lazy" decoding="async"
            className={loaded ? 'is-in' : ''} onLoad={() => setLoaded(true)} onError={() => setPhoto(null)} />
        )}
      </div>
      <p className="attribution">
        {photo && loaded ? (
          <>
            <a className="word" href={photo.fileUrl ?? photo.pageUrl} target="_blank" rel="noreferrer">photo · wikimedia commons</a>
            <button type="button" className="word" onClick={() => setOriginal((o) => !o)}>{original ? 'as printed' : 'see original'}</button>
          </>
        ) : (
          <span>no photograph · poster drawn from the spot's notes</span>
        )}
      </p>
    </>
  )
}
