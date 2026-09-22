import {
  Check,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  type LucideIcon,
} from "lucide-react"

/**
 * The mark of a range, from its place against the right one (`offset`, 0 for
 * the right one): the short answer's tick for the right values, a chevron
 * towards the others, doubled past the nearest range. The projector and the
 * result window mark the ranges alike.
 */
export const rangeIcon = (offset: number): LucideIcon => {
  if (offset === 0) {
    return Check
  }

  const [near, far] =
    offset < 0 ? [ChevronDown, ChevronsDown] : [ChevronUp, ChevronsUp]

  return Math.abs(offset) > 1 ? far : near
}
