import type {
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import { isWithinTolerance } from "@razzia/common/utils/estimate"

// A recorded estimate holds the number sent in `value`, null without an
// answer; its answerIds are empty.

/** The number a player sent, or null. */
export const valueOf = ({ value }: PlayerAnswerRecord): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null

/** Every number sent to the question. */
export const valuesOf = ({ playerAnswers }: QuestionResult): number[] =>
  playerAnswers.flatMap((record) => {
    const value = valueOf(record)

    return value === null ? [] : [value]
  })

/**
 * Whether the number was right: the score saved when the question closed,
 * or the tolerance for results saved without it.
 */
export const isRightValue = (
  question: QuestionResult,
  record: PlayerAnswerRecord,
): boolean => {
  const value = valueOf(record)

  if (value === null) {
    return false
  }

  return record.score === undefined
    ? isWithinTolerance(question, value)
    : record.score === 1
}
