import type {
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import {
  matchedItems,
  scoreAssociation,
} from "@razzia/common/utils/association"

// A recorded statements or categorize answer lists the target picked for each
// item, in the order of the question's answers; the right ones are its
// `expectedTargets`.

/**
 * Multiplier of a recorded answer: the one saved when the question closed,
 * or computed again from the question's scoring, as the server does. 0
 * without an answer.
 */
export const associationScore = (
  question: QuestionResult,
  record: PlayerAnswerRecord,
): number => {
  if (record.answerIds === null) {
    return 0
  }

  return (
    record.score ??
    scoreAssociation(
      record.answerIds,
      question.expectedTargets ?? [],
      question.options?.matchScoring,
    )
  )
}

/** Players who matched each item with its right target. */
export const matchedCounts = (question: QuestionResult): number[] => {
  const expected = question.expectedTargets ?? []
  const matched = question.playerAnswers.flatMap(({ answerIds }) =>
    answerIds === null ? [] : [matchedItems(answerIds, expected)],
  )

  return question.answers.map(
    (_, index) => matched.filter((items) => items[index]).length,
  )
}
