import type {
  ESTIMATE_TOLERANCE,
  MEDIA_TYPES,
  ORDER_SCORING,
  QUESTION_TYPES,
  SCORING_MODES,
} from "@razzia/common/constants"

export type QuestionType = (typeof QUESTION_TYPES)[keyof typeof QUESTION_TYPES]

export type ScoringMode = (typeof SCORING_MODES)[keyof typeof SCORING_MODES]

export type OrderScoring = (typeof ORDER_SCORING)[keyof typeof ORDER_SCORING]

export type EstimateTolerance =
  (typeof ESTIMATE_TOLERANCE)[keyof typeof ESTIMATE_TOLERANCE]

export interface MultiQuestionOptions {
  scoringMode: ScoringMode
}

// Public: sent to players along with the question.
export interface QuestionOptions {
  // Multi. The validator fills it in (balanced) whenever options are given,
  // whatever the type.
  scoringMode?: ScoringMode
  // Ordering, position when absent.
  orderScoring?: OrderScoring
  // Shortanswer: also accept a close spelling. Off when absent.
  typoTolerance?: boolean
  // Wordcloud: fields on the phone, 1 to 3, 1 when absent.
  wordCount?: number
  // Estimate: decimals a value may have, 0 to 3, 0 when absent. The right
  // value, the tolerance and the bounds have no more.
  decimals?: number
  // Estimate: how far from the right value an answer is still right,
  // bounds included, in the unit (absolute, the default) or as a percentage
  // of the right value. 0 when absent: the exact value only.
  tolerance?: number
  toleranceMode?: EstimateTolerance
  // Estimate: the values a player may send, bounds included, each optional.
  min?: number
  max?: number
  // Estimate: shown after the numbers (km, €, %...).
  unit?: string
}

export interface Player {
  id: string
  clientId: string
  connected: boolean
  username: string
  points: number
  // Scored questions answered correctly in a row, reset by a wrong answer.
  correctInARow: number
}

// A player as shown to the other players: the clientId lets its holder take
// over the seat on reconnect, so it never leaves the server.
export type PublicPlayer = Omit<Player, "clientId">

// An answer as the server keeps it until the question closes.
export interface Answer {
  playerId: string
  // Choice types: picked answers. Ordering: original indices, in the order
  // the player chose. Shortanswer: index of the accepted answer recognized,
  // or empty.
  answerIds: number[]
  // Shortanswer: the input once cleaned (cleanInput).
  text?: string
  // Wordcloud: the words kept (cleaned, deduplicated, moderated). Only held
  // until the question closes: the history keeps their count, not who typed
  // them.
  texts?: string[]
  // Estimate: the number sent, with no more decimals than the question's.
  value?: number
  points: number
}

// What a player sends: answer indices, a text for shortanswer (the number
// for an estimate), or 1 to 3 texts for wordcloud.
export type AnswerPayload =
  { answerKeys: number[] } | { text: string } | { texts: string[] }

export type QuestionMediaType =
  (typeof MEDIA_TYPES)[keyof typeof MEDIA_TYPES] | undefined

export interface QuestionMedia {
  type?: QuestionMediaType
  url: string
}

export interface Question {
  type: QuestionType
  question: string
  media?: QuestionMedia
  answers: string[]
  solutions: number[]
  cooldown: number
  time: number
  maxPoints?: number
  penalty?: number
  options?: QuestionOptions
  // Shortanswer: answers that score. Secret, never sent to a player.
  accepted?: string[]
  // Estimate: the right value. Secret, never sent to a player.
  expected?: number
  // Per-question switch, QUESTION_TYPE_META default when absent.
  speedBonus?: boolean
}

export interface Quizz {
  subject: string
  questions: Question[]
}

export type QuizzWithId = Quizz & { id: string }

export interface QuizzMeta {
  id: string
  subject: string
}

export interface GameUpdateQuestion {
  current: number
  total: number
}

export interface PlayerAnswerRecord {
  playerName: string
  // Null when the player did not answer. Same content as Answer.answerIds:
  // an empty list on a shortanswer is a text that matched nothing.
  answerIds: number[] | null
  // Shortanswer only: the cleaned input, null when the player did not answer.
  text?: string | null
  // Estimate only: the number sent, null when the player did not answer.
  // `answerIds` is then empty, or null without an answer.
  value?: number | null
  // Types that are not nominative (wordcloud, QUESTION_TYPE_META): whether
  // the player answered. `answerIds` is then empty, or null without an
  // answer, and the answer itself only counts in QuestionResult.words.
  answered?: boolean
  // Multiplier (0 to 1) applied when the question closed, 0 when the player
  // did not answer. Absent from results saved before it existed.
  score?: number
}

/**
 * A range of the estimate distribution: values from `from` to `to`, both
 * included, a null end being open. `correct` marks the values within the
 * tolerance.
 */
export interface EstimateRange {
  from: number | null
  to: number | null
  count: number
  correct: boolean
}

/** A word of a word cloud and the players who typed it, whoever they are. */
export interface WordCount {
  text: string
  count: number
}

export type QuestionResult = Question & {
  playerAnswers: PlayerAnswerRecord[]
  // Wordcloud: every word kept, the most frequent first (countWords).
  words?: WordCount[]
  // Wordcloud: the words were not kept, too few players typed any
  // (WORDCLOUD_LIMITS.MIN_AUTHORS). `words` is then absent.
  wordsWithheld?: boolean
}

export interface GameResultPlayer {
  username: string
  points: number
  rank: number
}

export interface GameResult {
  id: string
  // Quizz the game was played from. Absent for results saved before the
  // column existed, and for quizzes deleted since.
  quizzId?: string
  subject: string
  date: string
  players: GameResultPlayer[]
  questions: QuestionResult[]
}

/** One row of the statistics tab: a quizz that has been played at least once. */
export interface QuizzStatsMeta {
  quizzId: string
  subject: string
  gameCount: number
  playerCount: number
  // Correct answers over answers given, across every game and every scored
  // question. Null when the quizz has no scored question, or nobody answered.
  successRate: number | null
}

/** Aggregated results of one question, across every game of a quizz. */
export interface QuestionStats {
  question: string
  type: QuestionType
  scored: boolean
  gameCount: number
  answerCount: number
  missingCount: number
  correctCount: number
  successRate: number | null
  // Choice types: picks per answer. Ordering: the items in the correct order,
  // with the players who put each one at its place. Shortanswer: the
  // accepted answers, with the inputs each one recognized. Wordcloud: the
  // most frequent words across the games (WORDCLOUD_LIMITS.CLOUD_WORDS).
  // Estimate: empty, see `estimate`.
  answers: Array<{ label: string; count: number }>
  // Wording of the correct answers, taken from the most recent game: a quizz
  // can be edited between two games. Shortanswer: the accepted answers.
  // Ordering and estimate: empty, see `estimate` for the latter.
  solutionLabels: string[]
  // Ordering: mean multiplier over the answers given, null if none.
  // `correctCount` counts the exact orders.
  averageScore?: number | null
  // Shortanswer: inputs that matched no accepted answer.
  unrecognizedCount?: number
  // Wordcloud: no word to list because no game kept its words, too few
  // players having typed any (WORDCLOUD_LIMITS.MIN_AUTHORS).
  wordsWithheld?: boolean
  // Estimate: the answers below, within and above the tolerance of their
  // game, the median of every value given (null if none), and the right
  // value with its setting from the most recent game.
  estimate?: {
    below: number
    within: number
    above: number
    median: number | null
    expected: number | null
    options?: QuestionOptions
  }
}

export interface QuizzStats {
  quizzId: string
  subject: string
  gameCount: number
  playerCount: number
  questions: QuestionStats[]
}

export interface GameResultMeta {
  id: string
  subject: string
  date: string
  playerCount: number
}
