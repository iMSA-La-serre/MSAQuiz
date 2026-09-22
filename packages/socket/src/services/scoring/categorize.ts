import { QUESTION_TYPES } from "@razzia/common/constants"
import { scoreAssociation } from "@razzia/common/utils/association"
import type { ScoringFn } from "@razzia/socket/services/scoring"

export const type = QUESTION_TYPES.CATEGORIZE

// `answerIds` holds the category picked for each item, against the right
// ones in `expectedTargets`, as statements are scored (scoreAssociation).
export const scoring: ScoringFn = (question, { answerIds }) =>
  scoreAssociation(
    answerIds,
    question.expectedTargets ?? [],
    question.options?.matchScoring,
  )
