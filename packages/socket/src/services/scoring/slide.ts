import { QUESTION_TYPES } from "@razzia/common/constants"
import type { ScoringFn } from "@razzia/socket/services/scoring"

export const type = QUESTION_TYPES.SLIDE

// An info slide takes no answers at all.
export const scoring: ScoringFn = (): number => 0
