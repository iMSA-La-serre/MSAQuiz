import { SCORING_MODES } from "@razzia/common/constants"
import type {
  PlayerAnswerRecord,
  QuestionOptions,
  QuestionResult,
  ScoringMode,
} from "@razzia/common/types/game"
import { highlightScore } from "@razzia/web/features/questions/highlight/utils/records"

export { default as AnswerComponent } from "@razzia/web/features/questions/highlight/components/HighlightAnswers"

export { default as ConfigComponent } from "@razzia/web/features/questions/highlight/components/HighlightConfig"

// Used by its own editor, in the rows of the passages.
export { default as SolutionPicker } from "@razzia/web/features/questions/highlight/components/HighlightPicker"

export { default as AnswersEditor } from "@razzia/web/features/questions/highlight/components/HighlightEditor"

export { default as DistributionList } from "@razzia/web/features/questions/highlight/components/HighlightResponses"

export { default as ResultSummary } from "@razzia/web/features/questions/highlight/components/HighlightResultSummary"

export { default as ResultCells } from "@razzia/web/features/questions/highlight/components/HighlightResultCells"

export { default as StatsAnswers } from "@razzia/web/features/questions/highlight/components/HighlightStats"

export const labelKey = "quizz:questionType.highlight"

export const defaultOptions: QuestionOptions = {
  scoringMode: SCORING_MODES.BALANCED,
}

// The multiple choice's modes, the passages standing for its answers, but
// the lenient one: tapping every passage would earn full credit.
export const scoringModes: ScoringMode[] = [
  SCORING_MODES.STRICT,
  SCORING_MODES.BALANCED,
]

// The passages come from the text, which starts empty.
export const initialAnswers: string[] = []

// A text to read before tapping.
export const defaultTime = 45

// A text while answering, up to five rows in the distribution.
export const hostTopAligned = true

// Full credit only, every passage to spot and no other: a text partly
// searched is not counted as correct.
export const isCorrectRecord = (
  question: QuestionResult,
  record: PlayerAnswerRecord,
): boolean => highlightScore(question, record) === 1
