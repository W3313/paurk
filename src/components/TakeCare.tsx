import type { Spot } from '../types'

/** Honest, calm safety note (spec §6.11). Never red, never a triangle. */
export function TakeCare({ spot, night }: { spot: Spot; night: boolean }) {
  if (spot.safety.level !== 'caution' || !spot.safety.note) return null
  return (
    <section className="section" aria-labelledby={`care-${spot.id}`}>
      <h3 className="h3" id={`care-${spot.id}`}>take care</h3>
      <div className="takecare">
        <span className="caution-word"><span className="ring" aria-hidden="true" />{night ? 'caution after dark' : 'caution'}</span>
        <p><span className="vh">caution: </span>{spot.safety.note}</p>
      </div>
    </section>
  )
}
