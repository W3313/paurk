interface Props {
  parts: (string | number | null | undefined)[]
  /** Drops the printed "plate" prefix, for places that want the line bare. */
  bare?: boolean
}

/** One printed mono line under the globe: `plate · lisbon · 13 places · 18:42`. */
export function PlateCaption({ parts, bare = false }: Props) {
  const shown = parts.filter((p) => p !== null && p !== undefined && p !== '')
  return <p className="plate">{(bare ? shown : ['plate', ...shown]).join(' · ')}</p>
}
