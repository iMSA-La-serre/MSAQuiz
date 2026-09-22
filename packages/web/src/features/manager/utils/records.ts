import type { PlayerAnswerRecord } from "@razzia/common/types/game"

/**
 * Whether a record holds an answer. A shortanswer text that matched no
 * accepted answer is one too, with no answer id; records saved before texts
 * existed never have one. A word cloud answer only says it was given
 * (`answered`): its words are not linked to the player.
 */
export const hasAnswer = ({
  answerIds,
  text,
  answered,
}: PlayerAnswerRecord): boolean =>
  answerIds !== null &&
  (answerIds.length > 0 || typeof text === "string" || answered === true)
