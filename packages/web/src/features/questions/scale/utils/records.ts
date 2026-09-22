import type {
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import { scaleRangeOf, scaleSummary } from "@razzia/common/utils/scale"

// A scale keeps no answer per player: each record only says whether the
// player answered, and the levels are counted on the question.

/** Whether the player answered the scale. */
export const hasAnswered = ({ answerIds, answered }: PlayerAnswerRecord) =>
  answerIds !== null && answered === true

/**
 * What the question came to: the players of each level, from the lowest,
 * those who preferred not to answer, and the mean and median of the levels
 * picked (null when none was kept).
 */
export const scaleCountsOf = (
  question: QuestionResult,
): {
  counts: number[]
  skipped: number
  mean: number | null
  median: number | null
} => {
  const { min, count } = scaleRangeOf(question.options)
  const stored = question.scale
  const counts = Array.from(
    { length: count },
    (_, index) => stored?.counts.at(index) ?? 0,
  )
  const { mean, median } = scaleSummary(counts, min)

  return { counts, skipped: stored?.skipped ?? 0, mean, median }
}
