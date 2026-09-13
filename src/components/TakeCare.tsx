import type { Spot } from '../types'

/**
 * Honest, calm safety note (spec §6.11). Never red, never a triangle.
 *
 * Every spot that has a note gets one, not only the ones graded `caution`. 492 of the 604 notes shipped
 * in the bundle and were never rendered, and 114 of those carry concrete after-dark, gate, lighting or
 * tide advice on spots the app itself ranks into night lists — Ambury's vehicle gates locking on an unlit
 * park, Sandymount Strand on an incoming tide. The grade is a reviewer's judgement rather than a fact
 * about the place (Berkeley has 8 caution spots of 14; Bangkok and Hong Kong have none), so it decides
 * how loud the note is, not whether it is said at all: at `ok` there is no ochre word and no ring, and it
 * reads as the practical advice it is.
 */
export function TakeCare({ spot, night }: { spot: Spot; night: boolean }) {
  if (!spot.safety.note) return null
  const caution = spot.safety.level === 'caution'
  return (
    <section className="section" aria-labelledby={`care-${spot.id}`}>
      <h3 className="h3" id={`care-${spot.id}`}>take care</h3>
      <div className="takecare">
        {caution && <span className="caution-word"><span className="ring" aria-hidden="true" />{night ? 'caution after dark' : 'caution'}</span>}
        <p>{caution && <span className="vh">caution: </span>}{spot.safety.note}</p>
      </div>
    </section>
  )
}
