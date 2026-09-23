import {
  CREDIT_STEPS,
  FULL_CREDIT,
  QUESTION_TYPE_META,
  QUESTION_TYPES,
} from "@razzia/common/constants"
import type { Question, QuestionOptions } from "@razzia/common/types/game"

// Settings of the choice types, shared by the validator, the server and the
// web client: a poll that takes several answers, and a single choice whose
// other answers may earn part of the points.

type ChoiceQuestion = Pick<Question, "type" | "answers" | "solutions"> & {
  options?: QuestionOptions
}

/**
 * Whether a poll takes several answers, ticked then validated together, as
 * on a multiple choice. Every answer ticked counts in the distribution.
 */
export const pollMultiple = (
  question: Pick<Question, "type" | "options">,
): boolean =>
  question.type === QUESTION_TYPES.POLL && question.options?.multiple === true

/** Whether a credit is one an answer that is not right may earn. */
export const isCreditStep = (value: unknown): value is number =>
  typeof value === "number" &&
  (CREDIT_STEPS as readonly number[]).includes(value)

/**
 * The credit of each answer of a single choice, in percent, one per answer,
 * whatever `options.credits` holds: 100 for a right answer, the step stored
 * for another one, 0 when it is missing or not a step. Null when the question
 * is no single choice, or has no credits.
 */
export const storedCredits = (question: ChoiceQuestion): number[] | null => {
  const stored: unknown = question.options?.credits

  if (question.type !== QUESTION_TYPES.SINGLE || !Array.isArray(stored)) {
    return null
  }

  const steps: unknown[] = stored

  return question.answers.map((_, index) => {
    if (question.solutions.includes(index)) {
      return FULL_CREDIT
    }

    const credit = steps.at(index)

    return isCreditStep(credit) ? credit : 0
  })
}

/**
 * The credit of each answer, in percent, when a single choice gives part of
 * the points to at least one answer that is not right. Null otherwise: the
 * question then plays, scores and shows as a single choice always did.
 */
export const partialCredits = (question: ChoiceQuestion): number[] | null => {
  const credits = storedCredits(question)

  return credits?.some((credit) => credit > 0 && credit < FULL_CREDIT)
    ? credits
    : null
}

/**
 * Whether a multiplier strictly between 0 and 1 is a partial outcome rather
 * than a correct one: the types with partial credit, and a single choice
 * whose other answers earn part of the points.
 */
export const partialOutcomeOf = (question: ChoiceQuestion): boolean =>
  QUESTION_TYPE_META[question.type].partialOutcome ||
  partialCredits(question) !== null

/**
 * The settings players receive with the question: all of them but the
 * credits of a single choice, which tell the right answer as the solutions
 * do. The same object when there is nothing to leave out. Once the credits
 * are left out, none when nothing is left but the scoring mode the validator
 * fills in, which a single choice never reads: its question then reaches the
 * players as that of a single choice without credits, which has no settings.
 */
export const publicOptions = (
  options: QuestionOptions | undefined,
): QuestionOptions | undefined => {
  if (options?.credits === undefined) {
    return options
  }

  const { credits: _secret, ...rest } = options
  const kept = Object.keys(rest).filter((name) => name !== "scoringMode")

  return kept.length === 0 ? undefined : rest
}
