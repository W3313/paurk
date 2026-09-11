interface Props { parts: (string | number | null | undefined)[] }
/** One printed mono line under the globe: `plate · the world · 35 cities · 18:42 in lisbon`. */
export function PlateCaption({ parts }: Props) {
  return <p className="plate">{['plate', ...parts.filter((p) => p !== null && p !== undefined && p !== '')].join(' · ')}</p>
}
