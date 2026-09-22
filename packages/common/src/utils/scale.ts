import { SCALE_DEFAULTS, SCALE_LIMITS } from "@razzia/common/constants"
import type { QuestionOptions, ScaleCounts } from "@razzia/common/types/game"
import { cleanInput } from "@razzia/common/utils/text"

// The levels of a scale, read the same way by the phone, the projector and
// the server. A player sends the index of the level picked, or the index just
// past the last one for « Je préfère ne pas répondre » (scaleSkipIndex).

export interface ScaleRange {
  // Value of the first and of the last level, both included.
  min: number
  max: number
  // Levels between them, ends included.
  count: number
}

const clampInteger = (
  value: unknown,
  low: number,
  high: number,
): number | null =>
  typeof value === "number" && Number.isInteger(value)
    ? Math.min(high, Math.max(low, value))
    : null

/**
 * The levels a question offers: 1 to 5 unless the author set others, always
 * within the limits, so a stored question that says something else still
 * plays.
 */
export const scaleRangeOf = (
  options: QuestionOptions | undefined,
): ScaleRange => {
  const min =
    clampInteger(
      options?.scaleMin,
      SCALE_LIMITS.MIN_START,
      SCALE_LIMITS.MAX_START,
    ) ?? SCALE_DEFAULTS.START
  const end =
    clampInteger(options?.scaleMax, min + 1, SCALE_LIMITS.MAX_END) ??
    SCALE_DEFAULTS.END
  // At least three levels, and never more than the projector fits.
  const max = Math.min(
    Math.max(end, min + SCALE_LIMITS.MIN_LEVELS - 1),
    min + SCALE_LIMITS.MAX_LEVELS - 1,
    SCALE_LIMITS.MAX_END,
  )

  return { min, max, count: max - min + 1 }
}

/** The value of each level, the lowest first. */
export const scaleValues = (range: ScaleRange): number[] =>
  Array.from({ length: range.count }, (_, index) => range.min + index)

/** Whether the question offers « Je préfère ne pas répondre ». */
export const scaleSkipAllowed = (
  options: QuestionOptions | undefined,
): boolean => options?.scaleSkip === true

/**
 * The index that stands for « Je préfère ne pas répondre »: just past the
 * last level, so a level and a skip never read as the same answer.
 */
export const scaleSkipIndex = (range: ScaleRange): number => range.count

/** What an end of the scale stands for, once cleaned; empty when unset. */
export const scaleEndLabel = (
  options: QuestionOptions | undefined,
  end: "low" | "high",
): string => {
  const label = end === "low" ? options?.scaleLow : options?.scaleHigh

  return label === undefined ? "" : cleanInput(label)
}

/**
 * The counts of a question, from the answers given: how many players picked
 * each level, and how many preferred not to answer. An index that is neither
 * is left out.
 */
export const countScale = (
  answers: Iterable<readonly number[]>,
  range: ScaleRange,
): ScaleCounts => {
  const counts = Array.from({ length: range.count }, () => 0)
  const skip = scaleSkipIndex(range)
  let skipped = 0

  for (const answer of answers) {
    const index = answer.at(0)

    if (index === undefined) {
      continue
    }

    if (index === skip) {
      skipped += 1
    } else if (Number.isInteger(index) && index >= 0 && index < range.count) {
      counts[index] += 1
    }
  }

  return { counts, skipped }
}

/**
 * What the levels picked come to: how many players picked one, their mean and
 * their median, both null when nobody did. `counts` counts the players of
 * each level, from `min` up.
 */
export const scaleSummary = (
  counts: readonly number[],
  min: number,
): { answers: number; mean: number | null; median: number | null } => {
  const answers = counts.reduce((sum, count) => sum + Math.max(0, count), 0)

  if (answers === 0) {
    return { answers: 0, mean: null, median: null }
  }

  const total = counts.reduce(
    (sum, count, index) => sum + Math.max(0, count) * (min + index),
    0,
  )
  // The value at each half of the answers: the same value twice on an odd
  // count, the two middle ones averaged on an even one.
  const middle = (rank: number): number => {
    let seen = 0

    for (const [index, count] of counts.entries()) {
      seen += Math.max(0, count)

      if (seen >= rank) {
        return min + index
      }
    }

    return min + counts.length - 1
  }
  const low = middle(Math.floor((answers + 1) / 2))
  const high = middle(Math.floor(answers / 2) + 1)

  return { answers, mean: total / answers, median: (low + high) / 2 }
}
