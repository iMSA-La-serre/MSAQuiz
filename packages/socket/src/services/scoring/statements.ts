import { QUESTION_TYPES } from "@razzia/common/constants"
import { scoreAssociation } from "@razzia/common/utils/association"
import type { ScoringFn } from "@razzia/socket/services/scoring"

export const type = QUESTION_TYPES.STATEMENTS

// `answerIds` holds the target picked for each statement, Vrai (0) or Faux
// (1), against the right ones in `expectedTargets` (scoreAssociation).
export const scoring: ScoringFn = (question, { answerIds }) =>
  scoreAssociation(
    answerIds,
    question.expectedTargets ?? [],
    question.options?.matchScoring,
  )
