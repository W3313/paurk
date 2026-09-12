import { cities } from '../data'
import type { LatLng } from '../types'
import { PlateCaption } from './PlateCaption'
import { MarginNote } from './MarginNote'
import { WorldNow } from './WorldNow'

interface Props { now: Date; userPos: LatLng | null; onSearch: () => void; onAbout: () => void }

export function PhaseLine({ text, className = '' }: { text: string; className?: string }) {
  const words = text.split(' ')
  return <p className={`phase ${className}`} aria-label={text}>{words.map((w, i) => <span key={`${i}-${w}`}><span className="w" style={{ '--i': i } as React.CSSProperties}>{w}</span>{i < words.length - 1 ? ' ' : ''}</span>)}</p>
}

/** The Sky's text stack under the globe (spec §3.2). */
export function SkyText({ now, userPos, onSearch, onAbout }: Props) {
  return (
    <div className="sky-text">
      <PlateCaption parts={[`${cities.length} cities`]} bare />
      <MarginNote fallback={userPos ? 'tap a city, or the list below' : 'drag the globe, or search'} />
      <WorldNow now={now} onMore={() => onSearch()} />
      <p className="only-mobile"><button type="button" className="word word--quiet word--small" onClick={onAbout}>about</button></p>
    </div>
  )
}
