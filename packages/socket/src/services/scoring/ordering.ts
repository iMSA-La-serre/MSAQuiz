import { ORDER_SCORING, QUESTION_TYPES } from "@razzia/common/constants"
import { scoreOrdering } from "@razzia/common/utils/ordering"
import type { ScoringFn } from "@razzia/socket/services/scoring"

export const type = QUESTION_TYPES.ORDERING

// `answerIds` holds the original indices in the order the player chose, and
// the question's answers are stored in the correct order.
export const scoring: ScoringFn = (question, { answerIds }) =>
  scoreOrdering(
    answerIds,
    question.answers.length,
    question.options?.orderScoring ?? ORDER_SCORING.POSITION,
  )
