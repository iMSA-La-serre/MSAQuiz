import type {
  EstimateRange,
  Player,
  PublicPlayer,
  QuestionMedia,
  QuestionOptions,
  QuestionType,
  WordCount,
} from "@razzia/common/types/game"

export const STATUS = {
  SHOW_ROOM: "SHOW_ROOM",
  SHOW_START: "SHOW_START",
  SHOW_PREPARED: "SHOW_PREPARED",
  SHOW_QUESTION: "SHOW_QUESTION",
  SELECT_ANSWER: "SELECT_ANSWER",
  SHOW_RESULT: "SHOW_RESULT",
  SHOW_RESPONSES: "SHOW_RESPONSES",
  SHOW_LEADERBOARD: "SHOW_LEADERBOARD",
  FINISHED: "FINISHED",
  WAIT: "WAIT",
} as const

export type Status = (typeof STATUS)[keyof typeof STATUS]

// How a round ended for one player: scored questions give correct, wrong or
// noAnswer, polls and word clouds give voted or noVote. Partial only comes
// from the types with QUESTION_TYPE_META.partialOutcome (ordering,
// highlight): some credit, not all of it.
export type ResultOutcome =
  "correct" | "partial" | "wrong" | "noAnswer" | "voted" | "noVote"

// A leaderboard row carries the points gained (or lost) on the last question.
export type LeaderboardEntry = Player & { gain: number }

export interface CommonStatusDataMap {
  SHOW_START: { time: number; subject: string }
  SHOW_PREPARED: {
    // Length of the public answer list (0 for a shortanswer, a word cloud or
    // an estimate; the passages of a highlight).
    totalAnswers: number
    questionNumber: number
    questionType: QuestionType
  }
  SHOW_QUESTION: {
    question: string
    // Still image-only at this step: video and audio start with the answers.
    media?: QuestionMedia
    // Type only, so the screen can reserve the space of the upcoming media.
    upcomingMedia?: "video" | "audio"
    cooldown: number
    // Shown locked during the reading time, not accepted yet. The public
    // list: shuffled for an ordering (the same list as SELECT_ANSWER), empty
    // for a shortanswer, a word cloud or an estimate.
    answers: string[]
    questionType: QuestionType
    time: number
    totalPlayer: number
    // Public, as in SELECT_ANSWER: the answer area is laid out as it will be
    // (the fields of a word cloud, the unit and bounds of an estimate).
    options?: QuestionOptions
    // Highlight: the text, as in SELECT_ANSWER.
    text?: string
  }
  SELECT_ANSWER: {
    question: string
    // Public list, see SHOW_QUESTION. Ordering: answer with indices into it.
    answers: string[]
    media?: QuestionMedia
    time: number
    totalPlayer: number
    questionType: QuestionType
    options?: QuestionOptions
    // Highlight: the text, its passages between [brackets] being `answers`.
    text?: string
  }
  SHOW_RESULT: {
    outcome: ResultOutcome
    // Whether the answer earned credit: true for a partial outcome too. On a
    // poll, whether the vote was recorded.
    correct: boolean
    // I18n key of the heading, one per outcome; a word cloud has its own for
    // voted and noVote.
    message: string
    // Change actually applied to myPoints this round (a penalty after the
    // floor at 0).
    points: number
    myPoints: number
    rank: number
    totalPlayers: number
    // Ordering, partial outcome only: how many items the player put at their
    // place, which explains the partial points.
    placed?: { count: number; total: number }
    // Highlight, partial outcome only: the passages to spot the player found,
    // out of how many, and the other passages tapped.
    found?: { count: number; total: number; extra: number }
  }
  WAIT: { text: string }
  FINISHED: {
    subject: string
    top: PublicPlayer[]
    rank?: number
    totalPlayers?: number
  }
}

interface ManagerExtraStatus {
  SHOW_ROOM: { text: string; inviteCode?: string }
  SHOW_RESPONSES: {
    question: string
    // Keyed by index. Choice types: votes per answer. Ordering: players who
    // put item i (original index, `answers` being in the correct order) at
    // its place. Shortanswer: inputs recognized per accepted answer.
    responses: Record<number, number>
    solutions: number[]
    // The question's own list: the correct order for an ordering.
    answers: string[]
    // Shortanswer: the accepted answers, only ever sent to the manager.
    accepted?: string[]
    // Estimate: the right value, only ever sent to the manager, and the
    // question's settings (unit, decimals, bounds, tolerance).
    expected?: number
    options?: QuestionOptions
    // Estimate: the values sent, counted by range around the right value
    // (estimateRanges), and their median, null if none. `responses` is
    // empty.
    ranges?: EstimateRange[]
    median?: number | null
    // Wordcloud: the most frequent words (WORDCLOUD_LIMITS.CLOUD_WORDS), with
    // no link to who typed them, and how many different words were kept in
    // all. `responses` is empty.
    words?: WordCount[]
    distinctWords?: number
    // Ordering: the list players were shown, as indices into `answers`
    // (publicOrder[publicIndex] = index in answers), so the host can letter
    // each item as the phones did.
    publicOrder?: number[]
    media?: QuestionMedia
    type: QuestionType
    // Players who submitted an answer, the base of each answer's share.
    totalAnswered: number
    totalPlayers: number
    // Scored types: answers with full credit, and with some credit only.
    correctCount?: number
    partialCount?: number
  }
  SHOW_LEADERBOARD: { leaderboard: LeaderboardEntry[] }
}

export type PlayerStatusDataMap = CommonStatusDataMap

export type ManagerStatusDataMap = CommonStatusDataMap & ManagerExtraStatus

export type StatusDataMap = PlayerStatusDataMap & ManagerStatusDataMap
