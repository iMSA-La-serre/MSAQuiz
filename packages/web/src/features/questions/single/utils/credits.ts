import { FULL_CREDIT, QUESTION_TYPES } from "@razzia/common/constants"
import type { Question, QuestionOptions } from "@razzia/common/types/game"
import { isCreditStep, partialCredits } from "@razzia/common/utils/choice"
import { scoringModeLabelKey } from "@razzia/web/features/questions/options"

// A single choice with partial credit keeps a credit per answer in
// `options.credits`, in percent: 100 for a right answer, 0, 25, 50 or 75 for
// the others. The editor keeps the list in step with the answers and the
// right ones, as the validator stores it.

type CreditedQuestion = Pick<Question, "answers" | "solutions" | "options">

/** A credit as the screens write it: « 50 % ». */
export const formatCredit = (language: string, credit: number): string =>
  new Intl.NumberFormat(language, { style: "percent" }).format(
    credit / FULL_CREDIT,
  )

/** The credit an answer earns as the editor shows it. */
export const creditOf = (question: CreditedQuestion, index: number): number => {
  if (question.solutions.includes(index)) {
    return FULL_CREDIT
  }

  const credit = question.options?.credits?.at(index)

  return isCreditStep(credit) ? credit : 0
}

/** The credits once partial credit is turned on: none for a wrong answer. */
export const initialCredits = (question: CreditedQuestion): number[] =>
  question.answers.map((_, index) =>
    question.solutions.includes(index) ? FULL_CREDIT : 0,
  )

/**
 * The credits with the one of an answer changed, one per answer. The right
 * answers are rewritten at 100, so a right answer unticked earlier never
 * keeps a full credit it no longer has.
 */
export const withCredit = (
  question: CreditedQuestion,
  index: number,
  credit: number,
): number[] =>
  question.answers.map((_, answer) =>
    answer === index ? credit : creditOf(question, answer),
  )

/**
 * The credits once the right answers change: 100 for the right ones, and a
 * right answer unticked starts again from 0.
 */
export const creditsForSolutions = (
  question: CreditedQuestion,
  solutions: number[],
): number[] =>
  question.answers.map((_, index) => {
    if (solutions.includes(index)) {
      return FULL_CREDIT
    }

    return question.solutions.includes(index) ? 0 : creditOf(question, index)
  })

/** The credits once an answer is removed, the following ones moving up. */
export const creditsWithout = (credits: number[], index: number): number[] =>
  credits.filter((_, answer) => answer !== index)

/**
 * The setting the result window shows next to the time: « Crédit partiel »
 * once a wrong answer earns part of the points. Nothing when the switch was
 * left on with every credit at 0: the scoring mode stored with the credits
 * means nothing on a single choice. Without credits, the default, as before
 * single choices took them.
 */
export const creditsLabelKey = (
  question: Pick<Question, "answers" | "solutions"> & {
    options?: QuestionOptions
  },
): string | null => {
  const { options } = question

  if (options?.credits === undefined) {
    return scoringModeLabelKey(options)
  }

  return partialCredits({ ...question, type: QUESTION_TYPES.SINGLE })
    ? "quizz:question.config.credits"
    : null
}
