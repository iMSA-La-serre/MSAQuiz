import { QUESTION_TYPES } from "@razzia/common/constants"
import type { ScoringFn } from "@razzia/socket/services/scoring"

export const type = QUESTION_TYPES.POLL

// A poll has no correct answer: voting never awards points.
export const scoring: ScoringFn = (): number => 0
