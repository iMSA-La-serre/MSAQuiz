import { ORDER_SCORING } from "@razzia/common/constants"
import type {
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import { placedItems, scoreOrdering } from "@razzia/common/utils/ordering"

// A recorded order lists original indices, in the order the player chose;
// the question's answers are the items in the correct order.

/**
 * Multiplier of a recorded order: the one saved with the result, or computed
 * again from the question's scoring. 0 without an answer.
 */
export const orderingScore = (
  question: QuestionResult,
  record: PlayerAnswerRecord,
): number => {
  if (record.answerIds === null) {
    return 0
  }

  return (
    record.score ??
    scoreOrdering(
      record.answerIds,
      question.answers.length,
      question.options?.orderScoring ?? ORDER_SCORING.POSITION,
    )
  )
}

/** Players who put each item, in the correct order, at its place. */
export const placedCounts = (question: QuestionResult): number[] => {
  const { length } = question.answers
  const placed = question.playerAnswers.flatMap(({ answerIds }) =>
    answerIds === null ? [] : [placedItems(answerIds, length)],
  )

  return question.answers.map(
    (_, index) => placed.filter((items) => items[index]).length,
  )
}
