import {
  FULL_CREDIT,
  QUESTION_TYPE_META,
  QUESTION_TYPES,
} from "@razzia/common/constants"
import type {
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import { multiScore, partialCredits } from "@razzia/common/utils/choice"

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

type ChoiceQuestion = Pick<
  QuestionResult,
  "type" | "answers" | "solutions" | "options"
>

// The multiplier of a choice answer saved without one, worked out as the
// server does: a multiple choice in its scoring mode, a single choice from
// the one answer picked, with its credit when it is not right.
const choiceScore = (question: ChoiceQuestion, answerIds: number[]): number => {
  if (question.type === QUESTION_TYPES.MULTI) {
    return multiScore(
      answerIds,
      question.solutions,
      question.options?.scoringMode,
    )
  }

  if (answerIds.length !== 1) {
    return 0
  }

  const [picked] = answerIds

  if (question.solutions.includes(picked)) {
    return 1
  }

  return (partialCredits(question)?.at(picked) ?? 0) / FULL_CREDIT
}

/**
 * The verdict of a player's row in the result window, for the choice types
 * that bring no cells of their own, as the phone told the player: from the
 * multiplier saved with the answer, or worked out for a record saved without
 * one. Right with full credit, partly right with some (a multiple choice
 * missing a right answer or with a wrong one ticked, a single choice with
 * partial credits), wrong with none, a missing answer included, as it always
 * did. A poll has no right answer: the answer is recorded, as on the other
 * unscored types, or missing.
 */
export const choiceVerdict = (
  question: ChoiceQuestion,
  record: PlayerAnswerRecord,
): ChoiceVerdict => {
  const { answerIds, score } = record

  if (!QUESTION_TYPE_META[question.type].scored) {
    return { verdict: hasAnswer(record) ? "recorded" : "noAnswer" }
  }

  const multiplier = score ?? choiceScore(question, answerIds ?? [])

  if (multiplier >= 1) {
    return { verdict: "correct" }
  }

  return multiplier > 0
    ? { verdict: "partial", credit: Math.round(multiplier * 100) }
    : { verdict: "wrong" }
}
