import { MATCH_SCORING, QUESTION_TYPE_META } from "@razzia/common/constants"
import type {
  PlayerAnswerRecord,
  QuestionOptions,
  QuestionResult,
} from "@razzia/common/types/game"
import { matchScoringOf } from "@razzia/common/utils/association"
import { associationScore } from "@razzia/web/features/questions/association/utils/records"
import { categorizeHint } from "@razzia/web/features/questions/categorize/utils/hint"

export { default as AnswerComponent } from "@razzia/web/features/questions/categorize/components/CategorizeAnswers"

export { default as ConfigComponent } from "@razzia/web/features/questions/association/components/AssociationConfig"

// Not shown: the elements have their own editor, a category on each row.
export { default as SolutionPicker } from "@razzia/web/features/questions/slide/components/SlidePicker"

export { default as AnswersEditor } from "@razzia/web/features/questions/association/components/AssociationEditor"

export { default as DistributionList } from "@razzia/web/features/questions/association/components/AssociationResponses"

export { default as ResultSummary } from "@razzia/web/features/questions/association/components/AssociationResultSummary"

export { default as ResultCells } from "@razzia/web/features/questions/association/components/AssociationResultCells"

export { default as StatsAnswers } from "@razzia/web/features/questions/association/components/AssociationStats"

export const labelKey = "quizz:questionType.categorize"

export const defaultOptions: QuestionOptions = {
  matchScoring: MATCH_SCORING.SHARE,
}

export const initialAnswers: string[] = Array.from(
  { length: QUESTION_TYPE_META.categorize.minAnswers + 1 },
  () => "",
)

// Two categories to name, as a choice starts with two answers.
export const initialTargets: string[] = ["", ""]

// Several elements to sort.
export const defaultTime = 30

// The categories to sort into, named in the hint.
export const answerHint = categorizeHint

// Full credit only: elements partly sorted are not counted as correct.
export const isCorrectRecord = (
  question: QuestionResult,
  record: PlayerAnswerRecord,
): boolean => associationScore(question, record) === 1

export const optionsLabelKey = (options: QuestionOptions | undefined) =>
  `quizz:question.config.matchScoring.${matchScoringOf(options?.matchScoring)}`
