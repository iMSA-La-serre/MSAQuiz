import { FULL_CREDIT, QUESTION_TYPE_META } from "@razzia/common/constants"
import type {
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import { partialCredits } from "@razzia/common/utils/choice"

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

export type ChoiceVerdict =
  | { verdict: "correct" | "wrong" | "recorded" | "noAnswer" }
  // The share of the points earned, in percent.
  | { verdict: "partial"; credit: number }

/**
 * The verdict of a player's row in the result window, for the choice types
 * that bring no cells of their own. A scored question reads right or wrong,
 * a missing answer included, as it always did, or partly right on a single
 * choice with partial credits: the multiplier saved with the answer, or the
 * credit of the answer picked for a record saved without one. A poll has no
 * right answer: the answer is recorded, as on the other unscored types, or
 * missing.
 */
export const choiceVerdict = (
  question: Pick<QuestionResult, "type" | "answers" | "solutions" | "options">,
  record: PlayerAnswerRecord,
): ChoiceVerdict => {
  const { answerIds, score } = record

  if (!QUESTION_TYPE_META[question.type].scored) {
    return { verdict: hasAnswer(record) ? "recorded" : "noAnswer" }
  }

  if (answerIds?.some((id) => question.solutions.includes(id))) {
    return { verdict: "correct" }
  }

  const credits = partialCredits(question)
  const [picked] = answerIds ?? []
  const stored =
    answerIds?.length === 1 ? (credits?.at(picked) ?? 0) / FULL_CREDIT : 0
  const credit = credits ? Math.round((score ?? stored) * 100) : 0

  return credit > 0 ? { verdict: "partial", credit } : { verdict: "wrong" }
}
