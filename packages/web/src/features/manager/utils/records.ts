import type { PlayerAnswerRecord } from "@razzia/common/types/game"

/**
 * Whether a record holds an answer. A shortanswer text that matched no
 * accepted answer is one too, with no answer id, and so is an estimate value;
 * records saved before texts existed never have one. A word cloud answer only
 * says it was given (`answered`): its words are not linked to the player.
 */
export const hasAnswer = ({
  answerIds,
  text,
  value,
  answered,
}: PlayerAnswerRecord): boolean =>
  answerIds !== null &&
  (answerIds.length > 0 ||
    typeof text === "string" ||
    typeof value === "number" ||
    answered === true)
