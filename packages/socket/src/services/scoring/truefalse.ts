import { QUESTION_TYPES } from "@razzia/common/constants"
import { scoring as singleScoring } from "@razzia/socket/services/scoring/single"

export const type = QUESTION_TYPES.TRUEFALSE

// A true/false question is a single choice between two fixed answers, so it
// scores exactly like a single-choice one.
export const scoring = singleScoring
