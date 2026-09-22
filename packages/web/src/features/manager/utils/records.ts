import type { PlayerAnswerRecord } from "@razzia/common/types/game"

/**
 * Whether a record holds an answer. A shortanswer text that matched no
 * accepted answer is one too, with no answer id; records saved before texts
 * existed never have one.
 */
export const hasAnswer = ({ answerIds, text }: PlayerAnswerRecord): boolean =>
  answerIds !== null && (answerIds.length > 0 || typeof text === "string")
