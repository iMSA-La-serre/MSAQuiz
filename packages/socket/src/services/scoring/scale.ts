import { QUESTION_TYPES } from "@razzia/common/constants"
import type { ScoringFn } from "@razzia/socket/services/scoring"

export const type = QUESTION_TYPES.SCALE

// A scale has no right level: picking one never awards points.
export const scoring: ScoringFn = (): number => 0
