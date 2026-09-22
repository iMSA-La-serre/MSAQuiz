import { QUESTION_TYPE_META } from "@razzia/common/constants"

// Answered exactly like an ordering, tap after tap; only the order the
// author writes means something else, and nothing is right or wrong.
export { default as AnswerComponent } from "@razzia/web/features/questions/ranking/components/RankingAnswers"

// No scoring to set: the timings only, as a poll.
export { default as ConfigComponent } from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/BaseConfig"

// Not shown: a ranking has no right order.
export { default as SolutionPicker } from "@razzia/web/features/questions/slide/components/SlidePicker"

// The list editor of an ordering, worded for proposals.
export { default as AnswersEditor } from "@razzia/web/features/questions/ordering/components/OrderingEditor"

export { default as DistributionList } from "@razzia/web/features/questions/ranking/components/RankingResponses"

export { default as ResultSummary } from "@razzia/web/features/questions/ranking/components/RankingResultSummary"

export { default as ResultCells } from "@razzia/web/features/questions/ranking/components/RankingResultCells"

export { default as StatsAnswers } from "@razzia/web/features/questions/ranking/components/RankingStats"

export const labelKey = "quizz:questionType.ranking"

export const initialAnswers: string[] = Array.from(
  { length: QUESTION_TYPE_META.ranking.minAnswers },
  () => "",
)

// Several proposals to weigh, as an ordering's items.
export const defaultTime = 30

// Nobody is right or wrong.
export const isCorrectRecord = () => false
