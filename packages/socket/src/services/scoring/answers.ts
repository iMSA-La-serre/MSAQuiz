import { QUESTION_TYPES } from "@razzia/common/constants"
import type { Question } from "@razzia/common/types/game"

// Answer ids as sent by a player, checked against the question before they
// are stored. The scoring counts matching ids, so a repeated id would be
// credited once per copy: duplicates are dropped, and anything a regular
// client cannot send (unknown answer, several picks on a single choice) is
// refused with null.
export const parseAnswerIds = (
  question: Question,
  answerIds: unknown,
): number[] | null => {
  if (!Array.isArray(answerIds)) {
    return null
  }

  const ids = [...new Set<unknown>(answerIds)]
  const inRange = ids.every(
    (id) =>
      Number.isInteger(id) &&
      (id as number) >= 0 &&
      (id as number) < question.answers.length,
  )

  if (ids.length === 0 || !inRange) {
    return null
  }

  if (question.type !== QUESTION_TYPES.MULTI && ids.length > 1) {
    return null
  }

  return ids as number[]
}
