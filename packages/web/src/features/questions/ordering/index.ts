import { ORDER_SCORING, QUESTION_TYPE_META } from "@razzia/common/constants"
import type {
  PlayerAnswerRecord,
  QuestionOptions,
  QuestionResult,
} from "@razzia/common/types/game"
import { orderingScore } from "@razzia/web/features/questions/ordering/utils/records"

export { default as AnswerComponent } from "@razzia/web/features/questions/ordering/components/OrderingAnswers"

export { default as ConfigComponent } from "@razzia/web/features/questions/ordering/components/OrderingConfig"

// Not shown: the items have their own editor, where the order is the solution.
export { default as SolutionPicker } from "@razzia/web/features/questions/slide/components/SlidePicker"

export { default as AnswersEditor } from "@razzia/web/features/questions/ordering/components/OrderingEditor"

export { default as DistributionList } from "@razzia/web/features/questions/ordering/components/OrderingResponses"

export { default as ResultSummary } from "@razzia/web/features/questions/ordering/components/OrderingResultSummary"

export { default as ResultCells } from "@razzia/web/features/questions/ordering/components/OrderingResultCells"

export { default as StatsAnswers } from "@razzia/web/features/questions/ordering/components/OrderingStats"

export const labelKey = "quizz:questionType.ordering"

export const defaultOptions: QuestionOptions = {
  orderScoring: ORDER_SCORING.POSITION,
}

export const initialAnswers: string[] = Array.from(
  { length: QUESTION_TYPE_META.ordering.minAnswers },
  () => "",
)

export const defaultTime = 30

// Full credit only: an order partly right is not counted as correct.
export const isCorrectRecord = (
  question: QuestionResult,
  record: PlayerAnswerRecord,
): boolean => orderingScore(question, record) === 1

export const optionsLabelKey = (options: QuestionOptions | undefined) =>
  `quizz:question.config.orderScoring.${options?.orderScoring ?? ORDER_SCORING.POSITION}`
