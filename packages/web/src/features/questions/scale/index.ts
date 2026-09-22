import { SCALE_DEFAULTS } from "@razzia/common/constants"
import type { AnswerPayload, QuestionOptions } from "@razzia/common/types/game"
import { scaleRangeOf, scaleSkipIndex } from "@razzia/common/utils/scale"
import type { TFunction } from "i18next"

export { default as AnswerComponent } from "@razzia/web/features/questions/scale/components/ScaleAnswers"

export { default as ConfigComponent } from "@razzia/web/features/questions/scale/components/ScaleConfig"

// Not shown: a scale has no right level.
export { default as SolutionPicker } from "@razzia/web/features/questions/slide/components/SlidePicker"

export { default as AnswersEditor } from "@razzia/web/features/questions/scale/components/ScaleEditor"

export { default as DistributionList } from "@razzia/web/features/questions/scale/components/ScaleResponses"

export { default as ResultSummary } from "@razzia/web/features/questions/scale/components/ScaleResultSummary"

export { default as ResultCells } from "@razzia/web/features/questions/scale/components/ScaleResultCells"

export { default as StatsAnswers } from "@razzia/web/features/questions/scale/components/ScaleStats"

export const labelKey = "quizz:questionType.scale"

export const defaultOptions: QuestionOptions = {
  scaleMin: SCALE_DEFAULTS.START,
  scaleMax: SCALE_DEFAULTS.END,
}

// No public answers: the levels come from the settings.
export const initialAnswers: string[] = []

// One tap once the question is read.
export const defaultTime = 20

// One card while answering, a row per level in the distribution.
export const hostTopAligned = true

// Nobody is right or wrong.
export const isCorrectRecord = () => false

// The level picked, as the waiting screen should read it.
export const sentText = (
  t: TFunction,
  answer: AnswerPayload,
  options: QuestionOptions | undefined,
): string | undefined => {
  if (!("answerKeys" in answer)) {
    return undefined
  }

  const range = scaleRangeOf(options)
  const index = answer.answerKeys.at(0)

  if (index === undefined) {
    return undefined
  }

  return index === scaleSkipIndex(range)
    ? t("game:scale.skip")
    : t("game:scale.sent", { value: range.min + index, max: range.max })
}

// The scale, next to the time in the result window.
export const optionsLabel = (
  t: TFunction,
  options: QuestionOptions | undefined,
): string => {
  const { min, max } = scaleRangeOf(options)

  return t("quizz:scale.range", { min, max })
}
