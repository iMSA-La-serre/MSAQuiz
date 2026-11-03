import { QUESTION_TYPES } from "@razzia/common/constants"
import type { Question } from "@razzia/common/types/game"
import { multiScore } from "@razzia/common/utils/choice"
import type { ScoredAnswer, ScoringFn } from "@razzia/socket/services/scoring"

export const type = QUESTION_TYPES.MULTI

// The question's scoring mode, balanced when none is set (multiScore).
export const scoring: ScoringFn = (
  question: Question,
  { answerIds }: ScoredAnswer,
): number =>
  multiScore(answerIds, question.solutions, question.options?.scoringMode)
