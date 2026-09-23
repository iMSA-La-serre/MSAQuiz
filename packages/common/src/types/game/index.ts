import type {
  ESTIMATE_TOLERANCE,
  MATCH_SCORING,
  MEDIA_TYPES,
  ORDER_SCORING,
  QUESTION_TYPES,
  SCORING_MODES,
} from "@razzia/common/constants"

export type QuestionType = (typeof QUESTION_TYPES)[keyof typeof QUESTION_TYPES]

export type ScoringMode = (typeof SCORING_MODES)[keyof typeof SCORING_MODES]

export type OrderScoring = (typeof ORDER_SCORING)[keyof typeof ORDER_SCORING]

export type MatchScoring = (typeof MATCH_SCORING)[keyof typeof MATCH_SCORING]

export type EstimateTolerance =
  (typeof ESTIMATE_TOLERANCE)[keyof typeof ESTIMATE_TOLERANCE]

export interface MultiQuestionOptions {
  scoringMode: ScoringMode
}

// Public: sent to players along with the question.
export interface QuestionOptions {
  // Multi and highlight, which has no lenient mode (stored as balanced). The
  // validator fills it in (balanced) whenever options are given, whatever
  // the type.
  scoringMode?: ScoringMode
  // Ordering, position when absent.
  orderScoring?: OrderScoring
  // Statements and categorize, share when absent.
  matchScoring?: MatchScoring
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
  // Scale: the levels players pick from, `scaleMin` to `scaleMax`, both
  // included (1 to 5 when absent, SCALE_DEFAULTS).
  scaleMin?: number
  scaleMax?: number
  // Scale: what each end of the scale stands for, shown under the levels.
  scaleLow?: string
  scaleHigh?: string
  // Scale: offer « Je préfère ne pas répondre » under the levels. Off when
  // absent.
  scaleSkip?: boolean
  // Markers: several markers are right, so players pick as many as they want
  // and validate, as on a multiple choice. Filled in on save from the markers
  // ticked (markersMultiple); off when absent. Public: the phone needs it,
  // and it says nothing about which markers are right.
  multiple?: boolean
}

/**
 * Markers: where one marker sits on the question's image, as a percentage of
 * its width and of its height, so the screens place it whatever size the
 * image is shown at. Its label is the answer of the same index.
 */
export interface QuestionMarker {
  x: number
  y: number
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
  // Choice types: picked answers (markers: the markers tapped; highlight: the
  // passages tapped). Ordering
  // and ranking: original indices, in the order the player chose.
  // Shortanswer: index of the accepted answer recognized, or empty.
  // Statements and categorize: the target picked for each item, in the order
  // of the answers. Scale: the level picked, or the index past the last level
  // for « Je préfère ne pas répondre » (scaleSkipIndex).
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
  // Highlight: the text players read, its passages between [brackets]
  // (parseHighlight). Public: the passages are the answers, the ones to spot
  // are the solutions.
  text?: string
  // Statements and categorize: what each item is matched with, public.
  // Statements: Vrai and Faux (STATEMENT_TARGETS). Categorize: 2 to 4
  // categories.
  targets?: string[]
  // Statements and categorize: the index in `targets` of the right target of
  // each item, in the order of `answers`. Secret, never sent to a player.
  expectedTargets?: number[]
  // Markers: where each marker sits on the question's image, in the order of
  // `answers`, which holds their labels. Public: players tap them.
  markers?: QuestionMarker[]
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
  // Types that are not nominative (wordcloud, scale, QUESTION_TYPE_META):
  // whether the player answered. `answerIds` is then empty, or null without
  // an answer, and the answer itself only counts at the question level
  // (QuestionResult.words, QuestionResult.scale).
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

/**
 * What a scale came to, whoever answered: the players who picked each level,
 * from `scaleMin` up, and the players who preferred not to answer.
 */
export interface ScaleCounts {
  counts: number[]
  skipped: number
}

export type QuestionResult = Question & {
  playerAnswers: PlayerAnswerRecord[]
  // Wordcloud: every word kept, the most frequent first (countWords).
  words?: WordCount[]
  // Wordcloud: the words were not kept, too few players typed any
  // (WORDCLOUD_LIMITS.MIN_AUTHORS). `words` is then absent.
  wordsWithheld?: boolean
  // Scale: the levels picked, counted together.
  scale?: ScaleCounts
  // Scale: the counts were not kept, too few players picked a level
  // (SCALE_LIMITS.MIN_ANSWERS). `scale` is then absent.
  scaleWithheld?: boolean
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
  // Choice types: picks per answer; highlight lists every passage, in the
  // order of the text. Statements and categorize: every item, with the
  // players who matched it with its right target. Ordering: the items in the
  // correct order, with the players who put each one at its place. Ranking:
  // the proposals in the order the games ranked them, with the players who
  // put each one first. Shortanswer: the accepted answers, with the inputs
  // each one recognized. Wordcloud: the most frequent words across the games
  // (WORDCLOUD_LIMITS.CLOUD_WORDS). Scale: the levels, from `scale.min` up,
  // with the players who picked each. Estimate: empty, see `estimate`.
  answers: Array<{ label: string; count: number }>
  // Wording of the correct answers, taken from the most recent game: a quizz
  // can be edited between two games. Shortanswer: the accepted answers.
  // Statements and categorize: the right target of each item listed first in
  // `answers`, in the same order. Ordering and estimate: empty, see
  // `estimate` for the latter.
  solutionLabels: string[]
  // Ordering, highlight, statements and categorize: mean multiplier over the
  // answers given, null if none. `correctCount` counts the exact orders, the
  // answers with every passage to spot and no other, the answers with every
  // item matched.
  averageScore?: number | null
  // Shortanswer: inputs that matched no accepted answer.
  unrecognizedCount?: number
  // Wordcloud: no word to list because no game kept its words, too few
  // players having typed any (WORDCLOUD_LIMITS.MIN_AUTHORS).
  wordsWithheld?: boolean
  // Scale: the levels of the most recent game, the mean and the median of
  // every level picked across the games, the players who preferred not to
  // answer, and whether a game kept no count
  // (SCALE_LIMITS.MIN_ANSWERS), `answers` listing the counts.
  scale?: {
    min: number
    max: number
    low?: string
    high?: string
    skipped: number
    mean: number | null
    median: number | null
    withheld?: boolean
  }
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
