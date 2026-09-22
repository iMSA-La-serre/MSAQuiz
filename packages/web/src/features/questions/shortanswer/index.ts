import type {
  PlayerAnswerRecord,
  QuestionOptions,
  QuestionResult,
} from "@razzia/common/types/game"
import { isRecognized } from "@razzia/web/features/questions/shortanswer/utils/records"

export { default as AnswerComponent } from "@razzia/web/features/questions/shortanswer/components/ShortAnswerInput"

export { default as ConfigComponent } from "@razzia/web/features/questions/shortanswer/components/ShortAnswerConfig"

// Not shown: the accepted answers have their own editor.
export { default as SolutionPicker } from "@razzia/web/features/questions/slide/components/SlidePicker"

export { default as AnswersEditor } from "@razzia/web/features/questions/shortanswer/components/ShortAnswerEditor"

export { default as DistributionList } from "@razzia/web/features/questions/shortanswer/components/ShortAnswerResponses"

export { default as ResultSummary } from "@razzia/web/features/questions/shortanswer/components/ShortAnswerResultSummary"

export { default as ResultCells } from "@razzia/web/features/questions/shortanswer/components/ShortAnswerResultCells"

export { default as StatsAnswers } from "@razzia/web/features/questions/shortanswer/components/ShortAnswerStats"

export const labelKey = "quizz:questionType.shortanswer"

export const defaultOptions: QuestionOptions = { typoTolerance: false }

// No public answers: the player types a text, compared to `accepted`.
export const initialAnswers: string[] = []

export const initialAccepted = [""]

export const defaultTime = 40

// One row while answering, up to four in the distribution.
export const hostTopAligned = true

export const isCorrectRecord = (
  _question: QuestionResult,
  record: PlayerAnswerRecord,
): boolean => isRecognized(record)

export const optionsLabelKey = (options: QuestionOptions | undefined) =>
  options?.typoTolerance ? "quizz:question.config.typoTolerance" : null
