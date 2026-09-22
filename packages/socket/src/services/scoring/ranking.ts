import { QUESTION_TYPES } from "@razzia/common/constants"
import type { ScoringFn } from "@razzia/socket/services/scoring"

export const type = QUESTION_TYPES.RANKING

// A ranking has no correct order: ranking the proposals never awards points.
export const scoring: ScoringFn = (): number => 0
