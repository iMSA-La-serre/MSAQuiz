import { ESTIMATE_TOLERANCE } from "@razzia/common/constants"
import type {
  AnswerPayload,
  PlayerAnswerRecord,
  QuestionOptions,
  QuestionResult,
} from "@razzia/common/types/game"
import {
  checkEstimate,
  formatEstimate,
  formatTolerance,
  toleranceOf,
} from "@razzia/common/utils/estimate"
import { estimateHint } from "@razzia/web/features/questions/estimate/utils/format"
import { isRightValue } from "@razzia/web/features/questions/estimate/utils/records"
import type { TFunction } from "i18next"

export { default as AnswerComponent } from "@razzia/web/features/questions/estimate/components/EstimateInput"

export { default as ConfigComponent } from "@razzia/web/features/questions/estimate/components/EstimateConfig"

// Not shown: the right value has its own editor.
export { default as SolutionPicker } from "@razzia/web/features/questions/slide/components/SlidePicker"

export { default as AnswersEditor } from "@razzia/web/features/questions/estimate/components/EstimateEditor"

export { default as DistributionList } from "@razzia/web/features/questions/estimate/components/EstimateResponses"

export { default as ResultSummary } from "@razzia/web/features/questions/estimate/components/EstimateResultSummary"

export { default as ResultCells } from "@razzia/web/features/questions/estimate/components/EstimateResultCells"

export { default as StatsAnswers } from "@razzia/web/features/questions/estimate/components/EstimateStats"

export const labelKey = "quizz:questionType.estimate"

// A whole number from 0 up, right only when exact until the author sets a
// tolerance. The minimum of 0 gets phones their numeric keypad.
export const defaultOptions: QuestionOptions = {
  decimals: 0,
  tolerance: 0,
  toleranceMode: ESTIMATE_TOLERANCE.ABSOLUTE,
  min: 0,
}

// No public answers: the player types a number, compared to `expected`.
export const initialAnswers: string[] = []

export const defaultTime = 30

// One row while answering, five in the distribution.
export const hostTopAligned = true

export const answerHint = estimateHint

// The number sent, as the phone read it, with the unit.
export const sentText = (
  answer: AnswerPayload,
  options: QuestionOptions | undefined,
): string | undefined => {
  if (!("text" in answer)) {
    return undefined
  }

  const check = checkEstimate(answer.text, options)

  return check.ok ? formatEstimate(check.value, options) : undefined
}

export const isCorrectRecord = (
  question: QuestionResult,
  record: PlayerAnswerRecord,
): boolean => isRightValue(question, record)

// The tolerance, next to the time in the result window.
export const optionsLabel = (
  t: TFunction,
  options: QuestionOptions | undefined,
): string =>
  toleranceOf(options) > 0
    ? t("manager:result.tolerance", { tolerance: formatTolerance(options) })
    : t("manager:result.exactValue")
