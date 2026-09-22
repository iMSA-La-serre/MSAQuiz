import { WORDCLOUD_LIMITS } from "@razzia/common/constants"
import type { QuestionOptions } from "@razzia/common/types/game"
import { wordCountOf } from "@razzia/common/utils/wordcloud"

export { default as AnswerComponent } from "@razzia/web/features/questions/wordcloud/components/WordCloudInput"

export { default as ConfigComponent } from "@razzia/web/features/questions/wordcloud/components/WordCloudConfig"

// Not shown: a word cloud has no right answer.
export { default as SolutionPicker } from "@razzia/web/features/questions/slide/components/SlidePicker"

export { default as AnswersEditor } from "@razzia/web/features/questions/wordcloud/components/WordCloudEditor"

export { default as DistributionList } from "@razzia/web/features/questions/wordcloud/components/WordCloudResponses"

export { default as ResultSummary } from "@razzia/web/features/questions/wordcloud/components/WordCloudResultSummary"

export { default as ResultCells } from "@razzia/web/features/questions/wordcloud/components/WordCloudResultCells"

export { default as StatsAnswers } from "@razzia/web/features/questions/wordcloud/components/WordCloudStats"

export const labelKey = "quizz:questionType.wordcloud"

export const defaultOptions: QuestionOptions = {
  wordCount: WORDCLOUD_LIMITS.MIN_WORDS,
}

// No public answers: players type words, counted once the question closes.
export const initialAnswers: string[] = []

export const defaultTime = 40

// One row while answering, the cloud in the distribution.
export const hostTopAligned = true

// Nobody is right or wrong.
export const isCorrectRecord = () => false

// One key per count: the result window translates it without a count.
export const optionsLabelKey = (options: QuestionOptions | undefined) =>
  `quizz:wordcloud.setting.${wordCountOf(options)}`
