import { MARKERS_LIMITS } from "@razzia/common/constants"
import type { Question, QuestionMarker } from "@razzia/common/types/game"

// Markers: the author places numbered spots on the question's image, each
// with a short label. Shared by the validator, the server and the web client,
// so every screen places the markers the same way.

// Where a marker sits when the question says nothing usable: the middle of
// the image, where it stays visible.
const MIDDLE = Math.round(
  (MARKERS_LIMITS.MIN_PERCENT + MARKERS_LIMITS.MAX_PERCENT) / 2,
)

/** A percentage of the image, a whole number within the image. */
export const markerPercent = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return MIDDLE
  }

  return Math.min(
    MARKERS_LIMITS.MAX_PERCENT,
    Math.max(MARKERS_LIMITS.MIN_PERCENT, Math.round(value)),
  )
}

/**
 * Where each marker sits, one per answer, whatever the question holds: a
 * stored question edited by hand still plays, its markers within the image.
 */
export const markersOf = (
  question: Pick<Question, "answers" | "markers">,
): QuestionMarker[] =>
  question.answers.map((_, index) => {
    const marker = question.markers?.at(index)

    return { x: markerPercent(marker?.x), y: markerPercent(marker?.y) }
  })

/**
 * Whether players may tap several markers: the author ticked more than one,
 * and the answer is then scored as a multiple choice. The server reads the
 * markers ticked, which stay secret; the phone reads `options.multiple`,
 * filled in on save.
 */
export const markersMultiple = (
  question: Pick<Question, "solutions" | "options">,
): boolean =>
  question.solutions.length > 1 || question.options?.multiple === true

/**
 * The first marker placed on the same spot as an earlier one, once both are
 * rounded as they are stored, or -1: only the top one of two stacked markers
 * could be seen and tapped.
 */
export const stackedMarker = (markers: QuestionMarker[]): number => {
  const spots = new Set<string>()

  return markers.findIndex((marker) => {
    const spot = `${markerPercent(marker.x)}:${markerPercent(marker.y)}`

    if (spots.has(spot)) {
      return true
    }

    spots.add(spot)

    return false
  })
}
