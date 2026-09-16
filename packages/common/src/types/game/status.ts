import type {
  Player,
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
// noAnswer, polls give voted or noVote.
export type ResultOutcome =
  "correct" | "wrong" | "noAnswer" | "voted" | "noVote"

// A leaderboard row carries the points gained (or lost) on the last question.
export type LeaderboardEntry = Player & { gain: number }

export interface CommonStatusDataMap {
  SHOW_START: { time: number; subject: string }
  SHOW_PREPARED: {
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
    // Shown locked during the reading time, not accepted yet.
    answers: string[]
    questionType: QuestionType
    time: number
    totalPlayer: number
  }
  SELECT_ANSWER: {
    question: string
    answers: string[]
    media?: QuestionMedia
    time: number
    totalPlayer: number
    questionType: QuestionType
    options?: QuestionOptions
  }
  SHOW_RESULT: {
    outcome: ResultOutcome
    correct: boolean
    // I18n key of the heading, one per outcome.
    message: string
    // Change actually applied to myPoints this round (a penalty after the
    // floor at 0).
    points: number
    myPoints: number
    rank: number
    totalPlayers: number
  }
  WAIT: { text: string }
  FINISHED: {
    subject: string
    top: Player[]
    rank?: number
    totalPlayers?: number
  }
}

interface ManagerExtraStatus {
  SHOW_ROOM: { text: string; inviteCode?: string }
  SHOW_RESPONSES: {
    question: string
    responses: Record<number, number>
    solutions: number[]
    answers: string[]
    media?: QuestionMedia
    type: QuestionType
    // Players who submitted an answer, the base of each answer's share.
    totalAnswered: number
    totalPlayers: number
  }
  SHOW_LEADERBOARD: { leaderboard: LeaderboardEntry[] }
}

export type PlayerStatusDataMap = CommonStatusDataMap

export type ManagerStatusDataMap = CommonStatusDataMap & ManagerExtraStatus

export type StatusDataMap = PlayerStatusDataMap & ManagerStatusDataMap
