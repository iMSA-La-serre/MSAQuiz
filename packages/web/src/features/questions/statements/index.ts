import {
  MATCH_SCORING,
  QUESTION_TYPE_META,
  STATEMENT_TARGETS,
} from "@razzia/common/constants"
import type {
  PlayerAnswerRecord,
  QuestionOptions,
  QuestionResult,
} from "@razzia/common/types/game"
import { matchScoringOf } from "@razzia/common/utils/association"
import { associationScore } from "@razzia/web/features/questions/association/utils/records"

export { default as AnswerComponent } from "@razzia/web/features/questions/statements/components/StatementsAnswers"

export { default as ConfigComponent } from "@razzia/web/features/questions/association/components/AssociationConfig"

// Not shown: the statements have their own editor, Vrai or Faux on each row.
export { default as SolutionPicker } from "@razzia/web/features/questions/slide/components/SlidePicker"

export { default as AnswersEditor } from "@razzia/web/features/questions/association/components/AssociationEditor"

export { default as DistributionList } from "@razzia/web/features/questions/association/components/AssociationResponses"

export { default as ResultSummary } from "@razzia/web/features/questions/association/components/AssociationResultSummary"

export { default as ResultCells } from "@razzia/web/features/questions/association/components/AssociationResultCells"

export { default as StatsAnswers } from "@razzia/web/features/questions/association/components/AssociationStats"

export const labelKey = "quizz:questionType.statements"

export const defaultOptions: QuestionOptions = {
  matchScoring: MATCH_SCORING.SHARE,
}

export const initialAnswers: string[] = Array.from(
  { length: QUESTION_TYPE_META.statements.minAnswers + 1 },
  () => "",
)

export const initialTargets: string[] = [...STATEMENT_TARGETS]

// Several statements to read.
export const defaultTime = 30

// Full credit only: a series partly right is not counted as correct.
export const isCorrectRecord = (
  question: QuestionResult,
  record: PlayerAnswerRecord,
): boolean => associationScore(question, record) === 1

export const optionsLabelKey = (options: QuestionOptions | undefined) =>
  `quizz:question.config.matchScoring.${matchScoringOf(options?.matchScoring)}`
