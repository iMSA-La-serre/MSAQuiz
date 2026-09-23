import { FULL_CREDIT, QUESTION_TYPES } from "@razzia/common/constants"
import type { Question } from "@razzia/common/types/game"
import { partialCredits } from "@razzia/common/utils/choice"
import type { ScoredAnswer, ScoringFn } from "@razzia/socket/services/scoring"

export const type = QUESTION_TYPES.SINGLE

// A right answer earns 1, another one 0, or the share of the points its
// credit gives when the question has partial credits (partialCredits). A
// true/false question, scored the same way, never has any.
export const scoring: ScoringFn = (
  question: Question,
  { answerIds }: ScoredAnswer,
): number => {
  if (answerIds.length !== 1) {
    return 0
  }

  const [id] = answerIds

  if (question.solutions.includes(id)) {
    return 1
  }

  return (partialCredits(question)?.at(id) ?? 0) / FULL_CREDIT
}
