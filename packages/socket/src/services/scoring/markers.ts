import { QUESTION_TYPES } from "@razzia/common/constants"
import type { ScoringFn } from "@razzia/socket/services/scoring"
import { scoring as multiScoring } from "@razzia/socket/services/scoring/multi"

export const type = QUESTION_TYPES.MARKERS

// A marker tapped is an answer picked: the multiple choice's scale, which
// gives 1 or 0 whatever the mode when a single marker is right and players
// may only tap one.
export const scoring: ScoringFn = multiScoring
