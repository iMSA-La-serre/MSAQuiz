import type {
  Player,
  PublicPlayer,
  QuestionMedia,
  QuestionOptions,
  QuestionType,
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
// noAnswer, polls give voted or noVote. Partial only comes from the types with
// QUESTION_TYPE_META.partialOutcome (ordering): some credit, not all of it.
export type ResultOutcome =
  "correct" | "partial" | "wrong" | "noAnswer" | "voted" | "noVote"

// A leaderboard row carries the points gained (or lost) on the last question.
export type LeaderboardEntry = Player & { gain: number }

export interface CommonStatusDataMap {
  SHOW_START: { time: number; subject: string }
  SHOW_PREPARED: {
    // Length of the public answer list (0 for a shortanswer).
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
    // for a shortanswer.
    answers: string[]
    questionType: QuestionType
    time: number
    totalPlayer: number
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
  }
  SHOW_RESULT: {
    outcome: ResultOutcome
    // Whether the answer earned credit: true for a partial outcome too. On a
    // poll, whether the vote was recorded.
    correct: boolean
    // I18n key of the heading, one per outcome.
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
