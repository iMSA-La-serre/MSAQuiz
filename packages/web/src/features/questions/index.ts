import type {
  AnswerPayload,
  PlayerAnswerRecord,
  QuestionOptions,
  QuestionResult,
  QuestionType,
  ScoringMode,
} from "@razzia/common/types/game"
import * as categorize from "@razzia/web/features/questions/categorize"
import * as estimate from "@razzia/web/features/questions/estimate"
import * as highlight from "@razzia/web/features/questions/highlight"
import * as markers from "@razzia/web/features/questions/markers"
import * as multi from "@razzia/web/features/questions/multi"
import * as ordering from "@razzia/web/features/questions/ordering"
import * as poll from "@razzia/web/features/questions/poll"
import * as ranking from "@razzia/web/features/questions/ranking"
import * as scale from "@razzia/web/features/questions/scale"
import * as shortanswer from "@razzia/web/features/questions/shortanswer"
import * as single from "@razzia/web/features/questions/single"
import * as slide from "@razzia/web/features/questions/slide"
import * as statements from "@razzia/web/features/questions/statements"
import * as truefalse from "@razzia/web/features/questions/truefalse"
import * as wordcloud from "@razzia/web/features/questions/wordcloud"
import type {
  AnswerComponentProps,
  DistributionProps,
  QuestionMediaProps,
  ResultCellsProps,
  ResultSummaryProps,
  SolutionPickerProps,
  StatsAnswersProps,
} from "@razzia/web/features/questions/types"
import type { TFunction } from "i18next"
import type { ComponentType, PropsWithChildren } from "react"

// What a stage provider is given: the settings players may read, and where
// an answer goes once the type's blocks agree on one.
interface StageProviderProps {
  options?: QuestionOptions
  onSubmit: (_answer: AnswerPayload) => void
}

// Answer time a new question starts from, when its type sets none.
export const DEFAULT_ANSWER_TIME = 20

interface QuestionRegistryEntry {
  labelKey: string
  defaultOptions?: QuestionOptions
  // Translation keys of the fixed answers imposed when the author picks this
  // type (true/false); see QUESTION_TYPE_META.answersCount.
  defaultAnswerKeys?: string[]
  // Answers and accepted answers the author starts from when picking a type
  // that has its own answers editor.
  initialAnswers?: string[]
  initialAccepted?: string[]
  // The targets the author starts from (categorize: two empty categories).
  initialTargets?: string[]
  // Answer time in seconds, DEFAULT_ANSWER_TIME when absent.
  defaultTime?: number
  // Host screens: the stage starts at the top rather than in the middle.
  // For a type whose distribution has more rows than its answering screen,
  // so the title and the first row do not move at the reveal.
  hostTopAligned?: boolean
  scoringModes?: ScoringMode[]
  AnswerComponent: ComponentType<AnswerComponentProps>
  // The question's image with the type's own layer over it (the markers), in
  // place of the plain media block, on every screen that shows it.
  MediaComponent?: ComponentType<QuestionMediaProps>
  // Wraps the whole stage: what the type's blocks share while answering (the
  // markers tapped, which the image and the list both fill).
  StageProvider?: ComponentType<PropsWithChildren<StageProviderProps>>
  ConfigComponent: ComponentType
  SolutionPicker: ComponentType<SolutionPickerProps>
  // The views below replace the choice rendering (letters, solutions) for
  // the types that are not answered by picking choices.
  // Editor block under the question, instead of the answer rows.
  AnswersEditor?: ComponentType
  // Host screen after the question: the hint and rows under the title, in
  // place of the answer rows with bars (ResponseList, ResponseRow).
  DistributionList?: ComponentType<DistributionProps>
  // Result window: answers block, and each player's answer and verdict.
  ResultSummary?: ComponentType<ResultSummaryProps>
  ResultCells?: ComponentType<ResultCellsProps>
  // Whether a recorded answer counts as correct: full credit on most types,
  // any credit on markers, as their outcome; by default, whether it holds a
  // solution.
  isCorrectRecord?: (
    _question: QuestionResult,
    _record: PlayerAnswerRecord,
  ) => boolean
  // Result window: translation key of the setting shown next to the time;
  // by default, the multi scoring mode. `optionsLabel` gives the text itself
  // when it holds figures (a tolerance).
  optionsLabelKey?: (_options: QuestionOptions | undefined) => string | null
  optionsLabel?: (
    _t: TFunction,
    _options: QuestionOptions | undefined,
  ) => string | null
  // The hint above the answers when it depends on the settings (the bounds
  // and tolerance of an estimate) or on the targets and the screen (the
  // categories of a categorize question, named on the projector), in place
  // of the type's fixed one.
  answerHint?: (
    _t: TFunction,
    _options: QuestionOptions | undefined,
    _context: { targets?: string[]; size: "host" | "phone" },
  ) => string
  // The waiting screen: the answer sent, as it should read (an estimate's
  // number with its unit, the level of a scale), in place of the text typed
  // or the letters picked.
  sentText?: (
    _t: TFunction,
    _answer: AnswerPayload,
    _options: QuestionOptions | undefined,
  ) => string | undefined
  // Statistics: the answers list of a question card.
  StatsAnswers?: ComponentType<StatsAnswersProps>
}

export const QUESTION_REGISTRY: Record<QuestionType, QuestionRegistryEntry> = {
  single,
  multi,
  truefalse,
  poll,
  slide,
  ordering,
  shortanswer,
  wordcloud,
  estimate,
  highlight,
  statements,
  categorize,
  ranking,
  scale,
  markers,
}

export const QUESTION_TYPE_LIST = Object.keys(
  QUESTION_REGISTRY,
) as QuestionType[]

export const defaultTimeOf = (type: QuestionType): number =>
  QUESTION_REGISTRY[type].defaultTime ?? DEFAULT_ANSWER_TIME
