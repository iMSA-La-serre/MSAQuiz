import type {
  AnswerPayload,
  PlayerAnswerRecord,
  QuestionMarker,
  QuestionMedia,
  QuestionOptions,
  QuestionResult,
  QuestionStats,
  TimedMediaType,
} from "@razzia/common/types/game"
import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"

export interface AnswerComponentProps {
  answers: string[]
  options?: QuestionOptions
  // Highlight: the text, its passages between [brackets] being `answers`.
  text?: string
  // Statements and categorize: what each item of `answers` is matched with.
  targets?: string[]
  onSubmit: (_answer: AnswerPayload) => void
  // Host display: the rows are shown, never answered.
  readOnly?: boolean
  // Reading time: the rows are visible but do not accept answers yet.
  locked?: boolean
  size: "host" | "phone"
  // Taller rows with larger text (true/false on phone).
  large?: boolean
  // A video or a sound playing on the projected screen, which a slide's card
  // on a phone points to.
  screenMedia?: TimedMediaType
}

// The media block of a type that draws the question's image itself, with its
// own layer over it (markers).
export interface QuestionMediaProps {
  media?: QuestionMedia
  // Names the image: the question's wording, as the media block does.
  alt: string
  // The result window shows it smaller, next to the answers block.
  variant: "host" | "phone" | "result"
  // The answers the layer stands for: the markers' labels.
  answers: string[]
  // Markers: where each one sits on the image.
  markers?: QuestionMarker[]
  // Reading time: shown dimmed, no answer accepted yet.
  locked?: boolean
  // Host screens: shown, never answered.
  readOnly?: boolean
  // Distribution and result window: the right markers, once revealed.
  correct?: number[]
}

export interface SolutionPickerProps {
  index: number
  isSelected: boolean
}

// Host screen after the question.
export interface DistributionProps {
  data: ManagerStatusDataMap["SHOW_RESPONSES"]
  // Whether the right answers are marked yet: they appear with the bars.
  revealed: boolean
}

// Result window: the answers block of one question.
export interface ResultSummaryProps {
  question: QuestionResult
  // Players of the game with no answer to this question.
  noAnswerCount: number
}

// Result window: the answer and verdict cells of one player's row.
export interface ResultCellsProps {
  question: QuestionResult
  record: PlayerAnswerRecord
}

// Statistics: the answers list of one question card.
export interface StatsAnswersProps {
  question: QuestionStats
}
