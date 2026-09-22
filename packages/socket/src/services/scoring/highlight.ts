import { QUESTION_TYPES } from "@razzia/common/constants"
import { scoreHighlight } from "@razzia/common/utils/highlight"
import type { ScoringFn } from "@razzia/socket/services/scoring"

export const type = QUESTION_TYPES.HIGHLIGHT

// The passages tapped against the passages to spot, as the answers of a
// multi, in its strict or balanced mode (scoreHighlight).
export const scoring: ScoringFn = (question, { answerIds }) =>
  scoreHighlight(answerIds, question.solutions, question.options?.scoringMode)
