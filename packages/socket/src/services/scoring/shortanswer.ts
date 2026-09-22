import { QUESTION_TYPES } from "@razzia/common/constants"
import type { ScoringFn } from "@razzia/socket/services/scoring"

export const type = QUESTION_TYPES.SHORTANSWER

// The input is matched when it arrives: `answerIds` holds the accepted answer
// it was recognized as, or nothing.
export const scoring: ScoringFn = (_question, { answerIds }) =>
  answerIds.length > 0 ? 1 : 0
