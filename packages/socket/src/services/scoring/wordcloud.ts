import { QUESTION_TYPES } from "@razzia/common/constants"
import type { ScoringFn } from "@razzia/socket/services/scoring"

export const type = QUESTION_TYPES.WORDCLOUD

// A word cloud has no correct answer: taking part never awards points.
export const scoring: ScoringFn = (): number => 0
