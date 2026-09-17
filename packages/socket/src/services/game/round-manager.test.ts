import { MEDIA_TYPES, QUESTION_TYPES } from "@razzia/common/constants"
import type { Player, Question } from "@razzia/common/types/game"
import type { Server, Socket } from "@razzia/common/types/game/socket"
import {
  type Status,
  STATUS,
  type StatusDataMap,
} from "@razzia/common/types/game/status"
import type { CooldownTimer } from "@razzia/socket/services/game/cooldown-timer"
import type { PlayerManager } from "@razzia/socket/services/game/player-manager"
import { RoundManager } from "@razzia/socket/services/game/round-manager"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The scoring helpers live next to `withGame`, which reaches the game registry
// and the database behind it: both are stubbed rather than booted.
vi.mock("@razzia/socket/services/game", () => ({ default: {} }))
vi.mock("@razzia/socket/services/registry", () => ({
  default: { getInstance: () => ({ getGameById: () => null }) },
}))

const MANAGER_ID = "manager"

const player = (id: string, points = 0): Player => ({
  id,
  clientId: `client-${id}`,
  connected: true,
  username: id,
  points,
  correctInARow: 0,
})

const question = (over: Partial<Question> = {}): Question => ({
  type: QUESTION_TYPES.SINGLE,
  question: "Combien de temps met la lumière du Soleil ?",
  answers: ["8 secondes", "8 minutes", "8 heures", "8 jours"],
  solutions: [1],
  cooldown: 5,
  time: 20,
  ...over,
})

const socketOf = (id: string) =>
  ({
    id,
    emit: () => true,
    to: () => ({ emit: () => true }),
  }) as unknown as Socket

// Drives a RoundManager with stubbed players, timer and sockets, and records
// every status it broadcasts or sends.
const setup = (questions: Question[], players: Player[]) => {
  let roster = players
  const broadcasts: Array<{ name: Status; data: unknown }> = []
  const sent: Array<{ target: string; name: Status; data: unknown }> = []
  const openWindows: Array<() => void> = []
  let countdownDone = false

  const cooldown = {
    // The first call is the countdown before the first question.
    start: () => {
      if (!countdownDone) {
        countdownDone = true

        return Promise.resolve()
      }

      return new Promise<void>((resolve) => {
        openWindows.push(resolve)
      })
    },
    abort: () => {
      openWindows.splice(0).forEach((resolve) => {
        resolve()
      })
    },
  }

  const round = new RoundManager({
    quizz: { id: "quizz", subject: "Quiz de test", questions },
    players: {
      getAll: () => roster,
      replace: (next: Player[]) => {
        roster = next
      },
      findById: (id: string) => roster.find((p) => p.id === id),
      count: () => roster.length,
      broadcastCount: () => undefined,
    } as unknown as PlayerManager,
    cooldown: cooldown as unknown as CooldownTimer,
    io: { to: () => ({ emit: () => true }) } as unknown as Server,
    gameId: "game",
    getManagerId: () => MANAGER_ID,
    broadcast: (name, data) => {
      broadcasts.push({ name, data })
    },
    send: (target, name, data) => {
      sent.push({ target, name, data })
    },
    onNewQuestion: () => undefined,
    onGameFinished: () => undefined,
  })

  const manager = socketOf(MANAGER_ID)

  const lastBroadcast = <T extends Status>(name: T) =>
    broadcasts.findLast((entry) => entry.name === name)?.data as
      StatusDataMap[T] | undefined

  const lastSent = <T extends Status>(target: string, name: T) =>
    sent.findLast((entry) => entry.target === target && entry.name === name)
      ?.data as StatusDataMap[T] | undefined

  return {
    round,
    manager,
    sent,
    lastBroadcast,
    lastSent,
    // Start of the game, up to the reading time of the first question.
    reachFirstQuestion: async () => {
      void round.start(manager)
      await vi.advanceTimersByTimeAsync(5000)
    },
    reachNextQuestion: async () => {
      round.nextQuestion(manager)
      await vi.advanceTimersByTimeAsync(2000)
    },
    openAnswers: async (seconds: number) => {
      await vi.advanceTimersByTimeAsync(seconds * 1000)
    },
    closeAnswers: async () => {
      cooldown.abort()
      await vi.advanceTimersByTimeAsync(0)
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("RoundManager answer window", () => {
  it("shows the answers during the reading time, without the solutions", async () => {
    const game = setup([question()], [player("camille")])

    await game.reachFirstQuestion()

    const shown = game.lastBroadcast(STATUS.SHOW_QUESTION)

    expect(shown).toMatchObject({
      answers: ["8 secondes", "8 minutes", "8 heures", "8 jours"],
      questionType: QUESTION_TYPES.SINGLE,
      time: 20,
      totalPlayer: 1,
      cooldown: 5,
    })
    expect(shown).not.toHaveProperty("solutions")
    expect(shown?.upcomingMedia).toBeUndefined()
  })

  it("announces a video by its type only", async () => {
    const game = setup(
      [
        question({
          media: { type: MEDIA_TYPES.VIDEO, url: "https://example.org/v.mp4" },
        }),
      ],
      [player("camille")],
    )

    await game.reachFirstQuestion()

    const shown = game.lastBroadcast(STATUS.SHOW_QUESTION)

    expect(shown?.upcomingMedia).toBe(MEDIA_TYPES.VIDEO)
    expect(shown?.media).toBeUndefined()
  })

  it("ignores an answer sent during the reading time", async () => {
    const game = setup([question()], [player("camille"), player("yanis")])

    await game.reachFirstQuestion()
    game.round.selectAnswer(socketOf("camille"), [1])

    expect(game.lastSent("camille", STATUS.WAIT)).toBeUndefined()

    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), [1])

    expect(game.lastSent("camille", STATUS.WAIT)).toBeDefined()
  })

  it("ignores an answer sent after the results, also for the next question", async () => {
    const game = setup(
      [question(), question()],
      [player("camille"), player("yanis")],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), [1])
    await game.closeAnswers()
    game.round.selectAnswer(socketOf("yanis"), [1])

    expect(game.lastSent("yanis", STATUS.WAIT)).toBeUndefined()

    await game.reachNextQuestion()
    await game.openAnswers(5)
    await game.closeAnswers()

    expect(game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)).toMatchObject({
      totalAnswered: 0,
      totalPlayers: 2,
    })
  })
})

describe("RoundManager results", () => {
  it("reports each outcome with the change actually applied and the rank", async () => {
    const game = setup(
      [question({ penalty: 50 }), question()],
      [
        player("camille"),
        player("yanis", 30),
        player("ines", 200),
        player("samir"),
      ],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), [1])
    game.round.selectAnswer(socketOf("yanis"), [0])
    game.round.selectAnswer(socketOf("ines"), [2])
    await game.closeAnswers()

    const camille = game.lastSent("camille", STATUS.SHOW_RESULT)

    expect(camille).toMatchObject({
      outcome: "correct",
      correct: true,
      message: "game:correct",
      rank: 1,
      totalPlayers: 4,
    })
    expect(camille?.points).toBeGreaterThan(0)
    expect(camille?.myPoints).toBe(camille?.points)
    // No other player is named on a phone.
    expect(Object.keys(camille ?? {}).sort()).toEqual([
      "correct",
      "message",
      "myPoints",
      "outcome",
      "points",
      "rank",
      "totalPlayers",
    ])

    // The floor at 0 absorbs 20 of the 50-point penalty.
    expect(game.lastSent("yanis", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "wrong",
      correct: false,
      message: "game:wrong",
      points: -30,
      myPoints: 0,
      rank: 3,
    })
    expect(game.lastSent("ines", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "wrong",
      points: -50,
      myPoints: 150,
      rank: 2,
    })
    expect(game.lastSent("samir", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "noAnswer",
      correct: false,
      message: "game:noAnswer",
      points: 0,
      myPoints: 0,
      rank: 4,
    })
    expect(game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)).toMatchObject({
      type: QUESTION_TYPES.SINGLE,
      responses: { 0: 1, 1: 1, 2: 1 },
      totalAnswered: 3,
      totalPlayers: 4,
    })

    game.round.showLeaderboard(game.manager)

    const board = game.lastSent(MANAGER_ID, STATUS.SHOW_LEADERBOARD)

    // The previous order is no longer sent: only the new ranking.
    expect(Object.keys(board ?? {})).toEqual(["leaderboard"])
    expect(
      board?.leaderboard.map(({ username, gain }) => [username, gain]),
    ).toEqual([
      ["camille", camille?.points],
      ["ines", -50],
      ["yanis", -30],
      ["samir", 0],
    ])
  })

  it("credits a repeated answer once and ignores an unknown one", async () => {
    const game = setup(
      [question({ type: QUESTION_TYPES.MULTI, solutions: [0, 1] }), question()],
      [player("camille"), player("yanis"), player("samir")],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), [0, 1])
    game.round.selectAnswer(socketOf("yanis"), [0, 0, 0, 0, 0, 0])
    game.round.selectAnswer(socketOf("samir"), [7])

    expect(game.lastSent("samir", STATUS.WAIT)).toBeUndefined()

    await game.closeAnswers()

    const camille = game.lastSent("camille", STATUS.SHOW_RESULT)
    const yanis = game.lastSent("yanis", STATUS.SHOW_RESULT)

    // Same answer time: one right pick out of two is worth half the points.
    expect(camille?.points).toBeGreaterThan(0)
    expect(yanis?.points).toBe(Math.round((camille?.points ?? 0) / 2))
    expect(game.lastSent("samir", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "noAnswer",
      points: 0,
    })
    expect(game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)).toMatchObject({
      responses: { 0: 2, 1: 1 },
      totalAnswered: 2,
    })
  })

  it("confirms a vote or flags the missing one on a poll, with no gain", async () => {
    const game = setup(
      [question({ type: QUESTION_TYPES.POLL, solutions: [] }), question()],
      [player("camille", 100), player("yanis", 40)],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), [2])
    await game.closeAnswers()

    expect(game.lastSent("camille", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "voted",
      correct: true,
      message: "game:pollAnswered",
      points: 0,
      myPoints: 100,
      rank: 1,
      totalPlayers: 2,
    })
    expect(game.lastSent("yanis", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "noVote",
      correct: false,
      message: "game:pollNoVote",
      points: 0,
      rank: 2,
    })

    game.round.showLeaderboard(game.manager)

    const board = game.lastSent(MANAGER_ID, STATUS.SHOW_LEADERBOARD)

    expect(board?.leaderboard.every(({ gain }) => gain === 0)).toBe(true)
  })

  it("sends each player a final rank out of the total", async () => {
    const game = setup([question()], [player("camille"), player("yanis")])

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("yanis"), [1])
    await game.closeAnswers()
    game.round.showLeaderboard(game.manager)

    expect(game.lastSent("yanis", STATUS.FINISHED)).toMatchObject({
      rank: 1,
      totalPlayers: 2,
    })
    expect(game.lastSent("camille", STATUS.FINISHED)).toMatchObject({
      rank: 2,
      totalPlayers: 2,
    })
  })
})
