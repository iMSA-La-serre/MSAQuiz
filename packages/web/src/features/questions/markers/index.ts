import { SCORING_MODES } from "@razzia/common/constants"
import type { QuestionOptions } from "@razzia/common/types/game"
import { markersMultiple } from "@razzia/common/utils/markers"
import { isMarkersCorrect } from "@razzia/web/features/questions/markers/utils/records"
import type { TFunction } from "i18next"

export { default as AnswerComponent } from "@razzia/web/features/questions/markers/components/MarkersAnswers"

export { default as ConfigComponent } from "@razzia/web/features/questions/markers/components/MarkersConfig"

// Used by its own editor, in the rows of the markers.
export { default as SolutionPicker } from "@razzia/web/features/questions/markers/components/MarkersPicker"

export { default as AnswersEditor } from "@razzia/web/features/questions/markers/components/MarkersEditor"

// The question's image, the markers over it, on every screen that shows it.
export { default as MediaComponent } from "@razzia/web/features/questions/markers/components/MarkersImage"

// The markers tapped, which the image and the list under it both fill.
export { default as StageProvider } from "@razzia/web/features/questions/markers/context"

export { default as DistributionList } from "@razzia/web/features/questions/markers/components/MarkersResponses"

export { default as ResultSummary } from "@razzia/web/features/questions/markers/components/MarkersResultSummary"

export { default as ResultCells } from "@razzia/web/features/questions/markers/components/MarkersResultCells"

// Every marker numbered, as the result window and the export number them.
export { default as StatsAnswers } from "@razzia/web/features/questions/markers/components/MarkersStats"

export const labelKey = "quizz:questionType.markers"

export const defaultOptions: QuestionOptions = {
  scoringMode: SCORING_MODES.BALANCED,
}

// The markers are placed on the image, one by one.
export const initialAnswers: string[] = []

// An image to read before tapping.
export const defaultTime = 30

// Any credit earned, as the rows of the result window, the statistics and
// the phones count it: not the default, which counts an answer holding a
// right marker, even when a wrong one cost it all.
export const isCorrectRecord = isMarkersCorrect

// The scoring mode, next to the time in the result window, only when several
// markers are right: nothing else it applies to.
export const optionsLabelKey = (
  options: QuestionOptions | undefined,
): string | null => {
  const mode = options?.scoringMode

  return markersMultiple({ solutions: [], options }) && mode
    ? `quizz:question.config.scoringMode.${mode}`
    : null
}

// What the markers expect, worded from the markers ticked, in place of the
// type's fixed hint.
export const answerHint = (
  t: TFunction,
  options: QuestionOptions | undefined,
): string =>
  t(
    markersMultiple({ solutions: [], options })
      ? "game:answer.markersHintMultiple"
      : "game:answer.markersHint",
  )
