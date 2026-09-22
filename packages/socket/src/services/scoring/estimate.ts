import { QUESTION_TYPES } from "@razzia/common/constants"
import { isWithinTolerance } from "@razzia/common/utils/estimate"
import type { ScoredAnswer, ScoringFn } from "@razzia/socket/services/scoring"

export const type = QUESTION_TYPES.ESTIMATE

// All or nothing: the value sent is within the tolerance of the right value,
// bounds included.
export const scoring: ScoringFn = (question, { value }: ScoredAnswer) =>
  value !== undefined && isWithinTolerance(question, value) ? 1 : 0
