import { MEDIA_TYPES, QUESTION_TYPES } from "@razzia/common/constants"
import type { GameResult, Player, Question } from "@razzia/common/types/game"
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
const setup = (
  questions: Question[],
  players: Player[],
  moderationWords?: () => readonly string[],
) => {
  let roster = players
  const broadcasts: Array<{ name: Status; data: unknown }> = []
  const sent: Array<{ target: string; name: Status; data: unknown }> = []
  const finished: GameResult[] = []
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
    onGameFinished: (result) => {
      finished.push(result)
    },
    moderationWords,
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
    broadcasts,
    sent,
    finished,
    roster: () => roster,
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
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [1] })

    expect(game.lastSent("camille", STATUS.WAIT)).toBeUndefined()

    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [1] })

    expect(game.lastSent("camille", STATUS.WAIT)).toBeDefined()
  })

  it("ignores an answer sent after the results, also for the next question", async () => {
    const game = setup(
      [question(), question()],
      [player("camille"), player("yanis")],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [1] })
    await game.closeAnswers()
    game.round.selectAnswer(socketOf("yanis"), { answerKeys: [1] })

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
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [1] })
    game.round.selectAnswer(socketOf("yanis"), { answerKeys: [0] })
    game.round.selectAnswer(socketOf("ines"), { answerKeys: [2] })
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
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [0, 1] })
    game.round.selectAnswer(socketOf("yanis"), {
      answerKeys: [0, 0, 0, 0, 0, 0],
    })
    game.round.selectAnswer(socketOf("samir"), { answerKeys: [7] })

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
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [2] })
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
    game.round.selectAnswer(socketOf("yanis"), { answerKeys: [1] })
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

const ITEMS = ["Accueil", "Diagnostic", "Orientation", "Suivi"]

const ORDERING = question({
  type: QUESTION_TYPES.ORDERING,
  question: "Remettez les étapes dans l'ordre",
  answers: ITEMS,
  solutions: [],
  penalty: 100,
})

const SHORTANSWER = question({
  type: QUESTION_TYPES.SHORTANSWER,
  question: "Quel était le nom de Paris sous l'Empire romain ?",
  answers: [],
  solutions: [],
  accepted: ["Lutèce", "Lutetia"],
  penalty: 50,
})

// Indices into the list a player was shown, for the items in this order.
const keysFor = (shown: string[] | undefined, items: string[]) =>
  items.map((item) => shown?.indexOf(item) ?? -1)

describe("RoundManager, ordering", () => {
  it("shows the same shuffled list on every screen, never the correct order", async () => {
    const game = setup([ORDERING], [player("camille")])

    await game.reachFirstQuestion()

    const prepared = game.lastBroadcast(STATUS.SHOW_PREPARED)
    const reading = game.lastBroadcast(STATUS.SHOW_QUESTION)

    expect(prepared?.totalAnswers).toBe(4)
    expect(reading?.answers).not.toEqual(ITEMS)
    expect([...(reading?.answers ?? [])].sort()).toEqual([...ITEMS].sort())

    await game.openAnswers(5)

    expect(game.lastBroadcast(STATUS.SELECT_ANSWER)?.answers).toEqual(
      reading?.answers,
    )
  })

  it("scores the order sent, with partial credit, and penalizes only a miss", async () => {
    const game = setup(
      [ORDERING, question()],
      [
        player("camille"),
        player("samir"),
        player("yanis", 300),
        player("ines"),
      ],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)

    const shown = game.lastBroadcast(STATUS.SELECT_ANSWER)?.answers
    const [accueil, diagnostic, orientation, suivi] = ITEMS

    game.round.selectAnswer(socketOf("camille"), {
      answerKeys: keysFor(shown, ITEMS),
    })
    // Two items out of four at their place.
    game.round.selectAnswer(socketOf("samir"), {
      answerKeys: keysFor(shown, [accueil, diagnostic, suivi, orientation]),
    })
    // None at its place.
    game.round.selectAnswer(socketOf("yanis"), {
      answerKeys: keysFor(shown, [diagnostic, orientation, suivi, accueil]),
    })
    await game.closeAnswers()

    // No speed bonus by default: the base is the full 1000 points.
    expect(game.lastSent("camille", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "correct",
      correct: true,
      message: "game:correct",
      points: 1000,
    })
    expect(game.lastSent("samir", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "partial",
      correct: true,
      message: "game:partial",
      points: 500,
      myPoints: 500,
      placed: { count: 2, total: 4 },
    })
    // Only a partial result explains itself with the items placed.
    for (const name of ["camille", "yanis", "ines"]) {
      expect(game.lastSent(name, STATUS.SHOW_RESULT)).not.toHaveProperty(
        "placed",
      )
    }
    expect(game.lastSent("yanis", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "wrong",
      correct: false,
      points: -100,
      myPoints: 200,
    })
    expect(game.lastSent("ines", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "noAnswer",
      points: 0,
    })
    const responses = game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)

    expect(responses).toMatchObject({
      answers: ITEMS,
      responses: { 0: 2, 1: 2, 2: 1, 3: 1 },
      totalAnswered: 3,
      totalPlayers: 4,
      correctCount: 1,
      partialCount: 1,
    })
    // The host letters each item as the phones did.
    expect(responses?.publicOrder?.map((index) => ITEMS[index])).toEqual(shown)

    // Only a full order keeps a run of correct answers going.
    game.round.showLeaderboard(game.manager)

    const board = game.lastSent(MANAGER_ID, STATUS.SHOW_LEADERBOARD)

    expect(
      board?.leaderboard.map(({ username, correctInARow }) => [
        username,
        correctInARow,
      ]),
    ).toEqual([
      ["camille", 1],
      ["samir", 0],
      ["yanis", 0],
      ["ines", 0],
    ])
  })

  it("refuses an order that is not a permutation of the shown list", async () => {
    const game = setup([ORDERING], [player("camille"), player("yanis")])

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [0, 0, 1, 2] })
    game.round.selectAnswer(socketOf("yanis"), { text: "Accueil" })

    expect(game.lastSent("camille", STATUS.WAIT)).toBeUndefined()
    expect(game.lastSent("yanis", STATUS.WAIT)).toBeUndefined()
  })
})

describe("RoundManager, speed bonus", () => {
  it("gives the full points whatever the time when switched off", async () => {
    const game = setup(
      [question({ speedBonus: false, maxPoints: 800 }), question()],
      [player("camille"), player("yanis")],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [1] })
    await vi.advanceTimersByTimeAsync(15_000)
    game.round.selectAnswer(socketOf("yanis"), { answerKeys: [1] })
    await game.closeAnswers()

    expect(game.lastSent("camille", STATUS.SHOW_RESULT)?.points).toBe(800)
    expect(game.lastSent("yanis", STATUS.SHOW_RESULT)?.points).toBe(800)
  })

  it("gives the full points whatever the answer order without time limit", async () => {
    const game = setup(
      [{ ...ORDERING, time: -1 }, question()],
      [player("camille"), player("yanis")],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)

    const shown = game.lastBroadcast(STATUS.SELECT_ANSWER)?.answers

    game.round.selectAnswer(socketOf("camille"), {
      answerKeys: keysFor(shown, ITEMS),
    })
    game.round.selectAnswer(socketOf("yanis"), {
      answerKeys: keysFor(shown, ITEMS),
    })
    await game.closeAnswers()

    expect(game.lastSent("camille", STATUS.SHOW_RESULT)?.points).toBe(1000)
    expect(game.lastSent("yanis", STATUS.SHOW_RESULT)?.points).toBe(1000)
  })

  it("weighs a new type by time when switched on", async () => {
    const game = setup(
      [{ ...ORDERING, speedBonus: true }, question()],
      [player("camille"), player("yanis")],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    await vi.advanceTimersByTimeAsync(10_000)

    const shown = game.lastBroadcast(STATUS.SELECT_ANSWER)?.answers

    game.round.selectAnswer(socketOf("camille"), {
      answerKeys: keysFor(shown, ITEMS),
    })
    await game.closeAnswers()

    // Half of the 20 seconds gone: half of the points.
    expect(game.lastSent("camille", STATUS.SHOW_RESULT)?.points).toBe(500)
  })
})

describe("RoundManager, shortanswer", () => {
  it("shows no answers and matches the text typed", async () => {
    const game = setup(
      [SHORTANSWER],
      [player("camille"), player("yanis", 100), player("ines")],
    )

    await game.reachFirstQuestion()

    expect(game.lastBroadcast(STATUS.SHOW_PREPARED)?.totalAnswers).toBe(0)
    expect(game.lastBroadcast(STATUS.SHOW_QUESTION)?.answers).toEqual([])

    await game.openAnswers(5)

    expect(game.lastBroadcast(STATUS.SELECT_ANSWER)?.answers).toEqual([])

    // Indices mean nothing here.
    game.round.selectAnswer(socketOf("ines"), { answerKeys: [0] })

    expect(game.lastSent("ines", STATUS.WAIT)).toBeUndefined()

    game.round.selectAnswer(socketOf("camille"), { text: "  LUTECE " })
    game.round.selectAnswer(socketOf("yanis"), { text: "Paname" })
    await game.closeAnswers()

    expect(game.lastSent("camille", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "correct",
      correct: true,
      points: 1000,
    })
    expect(game.lastSent("yanis", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "wrong",
      correct: false,
      points: -50,
      myPoints: 50,
    })
    expect(game.lastSent("ines", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "noAnswer",
      points: 0,
    })
    expect(game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)).toMatchObject({
      accepted: ["Lutèce", "Lutetia"],
      responses: { 0: 1 },
      totalAnswered: 2,
      correctCount: 1,
      partialCount: 0,
    })

    game.round.showLeaderboard(game.manager)

    expect(game.finished[0]?.questions[0]?.playerAnswers).toEqual([
      { playerName: "camille", answerIds: [0], text: "LUTECE", score: 1 },
      { playerName: "yanis", answerIds: [], text: "Paname", score: 0 },
      { playerName: "ines", answerIds: null, text: null, score: 0 },
    ])
  })

  it("counts a recognized answer worth no points as correct, with no penalty", async () => {
    const game = setup(
      [
        { ...SHORTANSWER, maxPoints: 0, penalty: 100 },
        // The existing types keep their rule: no point earned is a miss.
        question({ maxPoints: 0, penalty: 100 }),
      ],
      [{ ...player("camille", 500), correctInARow: 2 }],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { text: "lutece" })
    await game.closeAnswers()

    expect(game.lastSent("camille", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "correct",
      correct: true,
      message: "game:correct",
      points: 0,
      myPoints: 500,
    })
    expect(game.roster()[0]?.correctInARow).toBe(3)
    expect(game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)).toMatchObject({
      correctCount: 1,
    })

    await game.reachNextQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [1] })
    await game.closeAnswers()

    expect(game.lastSent("camille", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "wrong",
      correct: false,
      points: -100,
      myPoints: 400,
    })
    expect(game.roster()[0]?.correctInARow).toBe(0)
  })
})

const WORDCLOUD = question({
  type: QUESTION_TYPES.WORDCLOUD,
  question: "En un mot, qu'attendez-vous de votre caisse ?",
  answers: [],
  solutions: [],
  options: { wordCount: 2 },
})

describe("RoundManager, wordcloud", () => {
  it("counts the words together and keeps only who answered", async () => {
    const game = setup(
      [WORDCLOUD],
      [
        player("camille", 300),
        player("yanis"),
        player("ines"),
        player("lea"),
        player("noe"),
      ],
      () => ["patate"],
    )

    await game.reachFirstQuestion()

    expect(game.lastBroadcast(STATUS.SHOW_PREPARED)?.totalAnswers).toBe(0)
    expect(game.lastBroadcast(STATUS.SHOW_QUESTION)).toMatchObject({
      answers: [],
      options: { wordCount: 2 },
    })

    await game.openAnswers(5)

    game.round.selectAnswer(socketOf("camille"), {
      texts: ["Écoute", "Proximité"],
    })
    game.round.selectAnswer(socketOf("yanis"), { texts: ["écoute", "Merde"] })
    // Every word dropped: the answer still counts, with no word.
    game.round.selectAnswer(socketOf("ines"), { texts: ["Patate"] })
    game.round.selectAnswer(socketOf("noe"), { texts: ["Écoute"] })

    expect(game.lastSent("ines", STATUS.WAIT)).toEqual({
      text: "game:waitingForAnswers",
    })

    await game.closeAnswers()

    expect(game.lastSent("camille", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "voted",
      correct: true,
      message: "game:wordcloudAnswered",
      points: 0,
      myPoints: 300,
    })
    expect(game.lastSent("ines", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "voted",
      message: "game:wordcloudAnswered",
    })
    expect(game.lastSent("lea", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "noVote",
      correct: false,
      message: "game:noAnswer",
      points: 0,
    })

    const responses = game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)

    expect(responses).toMatchObject({
      words: [
        { text: "Écoute", count: 3 },
        { text: "Proximité", count: 1 },
      ],
      distinctWords: 2,
      totalAnswered: 4,
      totalPlayers: 5,
    })
    // A plain toMatchObject would take any object for {}.
    expect(responses?.responses).toEqual({})
    expect(responses).not.toHaveProperty("correctCount")

    game.round.showLeaderboard(game.manager)

    const [saved] = game.finished[0].questions

    expect(saved.playerAnswers).toEqual([
      { playerName: "camille", answerIds: [], answered: true, score: 0 },
      { playerName: "yanis", answerIds: [], answered: true, score: 0 },
      { playerName: "ines", answerIds: [], answered: true, score: 0 },
      { playerName: "lea", answerIds: null, answered: false, score: 0 },
      { playerName: "noe", answerIds: [], answered: true, score: 0 },
    ])
    expect(saved.words).toEqual([
      { text: "Écoute", count: 3 },
      { text: "Proximité", count: 1 },
    ])
    expect(saved).not.toHaveProperty("wordsWithheld")
    // Nothing a player typed sits next to a username.
    expect(JSON.stringify(saved.playerAnswers)).not.toMatch(
      /coute|Proximit|Merde|Patate/u,
    )
  })

  it.each([
    ["one player", [["Écoute", "Terrain"]]],
    ["two players", [["Écoute"], ["Proximité"]]],
    // The third answer counts, but none of its words was kept.
    ["two players and a word dropped", [["Écoute"], ["Proximité"], ["Merde"]]],
  ])("keeps no word when %s typed the words kept", async (_, typedWords) => {
    const players = ["camille", "yanis", "ines", "lea"].map((id) => player(id))
    const game = setup([WORDCLOUD], players)

    await game.reachFirstQuestion()
    await game.openAnswers(5)

    for (const [index, texts] of typedWords.entries()) {
      game.round.selectAnswer(socketOf(players[index].id), { texts })
    }

    await game.closeAnswers()

    // The room still sees them.
    expect(
      game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)?.words,
    ).not.toHaveLength(0)

    game.round.showLeaderboard(game.manager)

    const [saved] = game.finished[0].questions

    expect(saved.wordsWithheld).toBe(true)
    expect(saved).not.toHaveProperty("words")
    expect(saved.playerAnswers.filter(({ answered }) => answered)).toHaveLength(
      typedWords.length,
    )
    expect(JSON.stringify(saved)).not.toMatch(/coute|Terrain|Proximit/u)
  })

  it("has nothing to withhold when no word was kept", async () => {
    const game = setup([WORDCLOUD], [player("camille"), player("yanis")])

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { texts: ["Merde"] })
    await game.closeAnswers()
    game.round.showLeaderboard(game.manager)

    const [saved] = game.finished[0].questions

    expect(saved.words).toEqual([])
    expect(saved).not.toHaveProperty("wordsWithheld")
  })

  it("shows the most frequent words only, but keeps them all", async () => {
    const players = Array.from({ length: 35 }, (_, index) =>
      player(`joueur${index}`),
    )
    const game = setup([{ ...WORDCLOUD, options: { wordCount: 1 } }], players)

    await game.reachFirstQuestion()
    await game.openAnswers(5)

    for (const [index, { id }] of players.entries()) {
      game.round.selectAnswer(socketOf(id), { texts: [`Mot ${index}`] })
    }

    await game.closeAnswers()

    const responses = game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)

    expect(responses?.words).toHaveLength(30)
    expect(responses?.distinctWords).toBe(35)

    game.round.showLeaderboard(game.manager)

    expect(game.finished[0]?.questions[0]?.words).toHaveLength(35)
  })

  it("reads moderation.txt at each word cloud", async () => {
    const moderationWords = vi.fn(() => ["patate"])
    const game = setup(
      [WORDCLOUD, question(), WORDCLOUD],
      [player("camille")],
      moderationWords,
    )

    await game.reachFirstQuestion()

    expect(moderationWords).toHaveBeenCalledTimes(1)

    await game.openAnswers(5)
    await game.closeAnswers()
    await game.reachNextQuestion()

    expect(moderationWords).toHaveBeenCalledTimes(1)

    await game.openAnswers(5)
    await game.closeAnswers()
    moderationWords.mockReturnValue(["tomate"])
    await game.reachNextQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), {
      texts: ["Tomate", "Patate"],
    })
    await game.closeAnswers()

    expect(moderationWords).toHaveBeenCalledTimes(2)
    expect(game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)?.words).toEqual([
      { text: "Patate", count: 1 },
    ])
  })

  it("never sends a word to a player", async () => {
    const game = setup([WORDCLOUD], [player("camille"), player("yanis")])

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), {
      texts: ["Solidarité", "Terrain"],
    })
    await game.closeAnswers()
    game.round.showLeaderboard(game.manager)

    const toPlayers = [
      ...game.broadcasts,
      ...game.sent.filter(({ target }) => target !== MANAGER_ID),
    ]

    expect(JSON.stringify(toPlayers)).not.toMatch(/Solidarit|Terrain/u)
  })
})

const ESTIMATE = question({
  type: QUESTION_TYPES.ESTIMATE,
  question: "Combien d'adhérents compte la caisse ?",
  answers: [],
  solutions: [],
  expected: 4271,
  options: {
    tolerance: 5,
    toleranceMode: "percent",
    min: 0,
    unit: "adhérents",
  },
  penalty: 50,
})

describe("RoundManager, estimate", () => {
  it("reads the number typed and scores it within the tolerance", async () => {
    const game = setup(
      [ESTIMATE],
      [player("camille"), player("yanis", 100), player("ines"), player("lea")],
    )

    await game.reachFirstQuestion()

    expect(game.lastBroadcast(STATUS.SHOW_PREPARED)?.totalAnswers).toBe(0)
    expect(game.lastBroadcast(STATUS.SHOW_QUESTION)?.answers).toEqual([])

    await game.openAnswers(5)

    // Indices, a number out of the bounds, a text that is no number: ignored.
    game.round.selectAnswer(socketOf("ines"), { answerKeys: [0] })
    game.round.selectAnswer(socketOf("ines"), { text: "-3" })
    game.round.selectAnswer(socketOf("ines"), { text: "4 271 adhérents" })

    expect(game.lastSent("ines", STATUS.WAIT)).toBeUndefined()

    // 5 % of 4 271, rounded down: 4 058 to 4 484.
    game.round.selectAnswer(socketOf("camille"), { text: "4 484" })
    game.round.selectAnswer(socketOf("yanis"), { text: "4485" })
    game.round.selectAnswer(socketOf("lea"), { text: "3000,0" })
    await game.closeAnswers()

    expect(game.lastSent("camille", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "correct",
      correct: true,
      points: 1000,
    })
    expect(game.lastSent("yanis", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "wrong",
      correct: false,
      points: -50,
      myPoints: 50,
    })
    expect(game.lastSent("ines", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "noAnswer",
      points: 0,
    })

    const responses = game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)

    expect(responses).toMatchObject({
      expected: 4271,
      responses: {},
      median: 4484,
      totalAnswered: 3,
      correctCount: 1,
      partialCount: 0,
    })
    expect(
      responses?.ranges?.map(({ from, to, count, correct }) => ({
        from,
        to,
        count,
        correct,
      })),
    ).toEqual([
      { from: 0, to: 3557, count: 1, correct: false },
      { from: 3558, to: 4057, count: 0, correct: false },
      { from: 4058, to: 4484, count: 1, correct: true },
      { from: 4485, to: 4984, count: 1, correct: false },
      { from: 4985, to: null, count: 0, correct: false },
    ])

    game.round.showLeaderboard(game.manager)

    expect(game.finished[0]?.questions[0]?.playerAnswers).toEqual([
      { playerName: "camille", answerIds: [], value: 4484, score: 1 },
      { playerName: "yanis", answerIds: [], value: 4485, score: 0 },
      { playerName: "ines", answerIds: null, value: null, score: 0 },
      { playerName: "lea", answerIds: [], value: 3000, score: 0 },
    ])
  })

  it("counts a right value worth no points as correct, with no penalty", async () => {
    const game = setup(
      [{ ...ESTIMATE, maxPoints: 0, penalty: 100 }],
      [{ ...player("camille", 500), correctInARow: 2 }],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { text: "4271" })
    await game.closeAnswers()

    expect(game.lastSent("camille", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "correct",
      message: "game:correct",
      points: 0,
      myPoints: 500,
    })
    expect(game.roster()[0]?.correctInARow).toBe(3)
  })

  it("has no median and no count without an answer", async () => {
    const game = setup([ESTIMATE], [player("camille")])

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    await game.closeAnswers()

    const responses = game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)

    expect(responses?.median).toBeNull()
    expect(responses?.ranges?.every(({ count }) => count === 0)).toBe(true)
  })
})

const HIGHLIGHT = question({
  type: QUESTION_TYPES.HIGHLIGHT,
  question: "Repérez les deux délais à respecter",
  text: "Prévenez votre employeur [sous 48 heures], envoyez l'arrêt [sous 48 heures aussi] et [gardez une copie].",
  answers: ["sous 48 heures", "sous 48 heures aussi", "gardez une copie"],
  solutions: [0, 1],
  options: { scoringMode: "balanced" },
  penalty: 100,
})

describe("RoundManager, highlight", () => {
  it("sends the text with its passages, in their order", async () => {
    const game = setup([HIGHLIGHT], [player("camille")])

    await game.reachFirstQuestion()

    expect(game.lastBroadcast(STATUS.SHOW_PREPARED)?.totalAnswers).toBe(3)
    expect(game.lastBroadcast(STATUS.SHOW_QUESTION)).toMatchObject({
      text: HIGHLIGHT.text,
      answers: HIGHLIGHT.answers,
    })

    await game.openAnswers(5)

    expect(game.lastBroadcast(STATUS.SELECT_ANSWER)).toMatchObject({
      text: HIGHLIGHT.text,
      answers: HIGHLIGHT.answers,
    })
  })

  it("scores the passages tapped as a multi, with a partial outcome", async () => {
    const game = setup(
      [HIGHLIGHT],
      [
        player("camille"),
        player("samir"),
        player("yanis", 300),
        player("ines"),
        player("lea"),
      ],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [1, 0] })
    game.round.selectAnswer(socketOf("samir"), { answerKeys: [0] })
    // Both found, one tapped too many: (2 - 1) / 2 in the balanced mode.
    game.round.selectAnswer(socketOf("lea"), { answerKeys: [0, 1, 2] })
    game.round.selectAnswer(socketOf("yanis"), { answerKeys: [2] })
    await game.closeAnswers()

    // No speed bonus by default: the base is the full 1000 points.
    expect(game.lastSent("camille", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "correct",
      message: "game:correct",
      points: 1000,
    })
    expect(game.lastSent("samir", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "partial",
      correct: true,
      message: "game:partial",
      points: 500,
      found: { count: 1, total: 2, extra: 0 },
    })
    expect(game.lastSent("lea", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "partial",
      points: 500,
      found: { count: 2, total: 2, extra: 1 },
    })
    expect(game.lastSent("yanis", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "wrong",
      points: -100,
      myPoints: 200,
    })

    // Only a partial result explains itself with the passages found.
    for (const name of ["camille", "yanis", "ines"]) {
      expect(game.lastSent(name, STATUS.SHOW_RESULT)).not.toHaveProperty(
        "found",
      )
    }

    expect(game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)).toMatchObject({
      answers: HIGHLIGHT.answers,
      solutions: [0, 1],
      responses: { 0: 3, 1: 2, 2: 2 },
      totalAnswered: 4,
      correctCount: 1,
      partialCount: 2,
    })

    game.round.showLeaderboard(game.manager)

    expect(game.finished[0]?.questions[0]?.playerAnswers).toEqual([
      { playerName: "camille", answerIds: [1, 0], score: 1 },
      { playerName: "samir", answerIds: [0], score: 0.5 },
      { playerName: "yanis", answerIds: [2], score: 0 },
      { playerName: "ines", answerIds: null, score: 0 },
      { playerName: "lea", answerIds: [0, 1, 2], score: 0.5 },
    ])
  })

  it("scores a lenient highlight as balanced: every passage is not flawless", async () => {
    const game = setup(
      [{ ...HIGHLIGHT, options: { scoringMode: "lenient" } }],
      [player("camille"), player("samir")],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [0, 1, 2] })
    game.round.selectAnswer(socketOf("samir"), { answerKeys: [0, 1] })
    await game.closeAnswers()

    expect(game.lastSent("camille", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "partial",
      points: 500,
      found: { count: 2, total: 2, extra: 1 },
    })
    expect(game.lastSent("samir", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "correct",
      points: 1000,
    })
    expect(game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)).toMatchObject({
      correctCount: 1,
      partialCount: 1,
    })
  })

  it("refuses an unknown passage or a text", async () => {
    const game = setup([HIGHLIGHT], [player("camille"), player("yanis")])

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [3] })
    game.round.selectAnswer(socketOf("yanis"), { text: "sous 48 heures" })

    expect(game.lastSent("camille", STATUS.WAIT)).toBeUndefined()
    expect(game.lastSent("yanis", STATUS.WAIT)).toBeUndefined()
  })
})

const STATEMENTS = question({
  type: QUESTION_TYPES.STATEMENTS,
  question: "Vrai ou faux ?",
  answers: [
    "La MSA couvre les salariés agricoles",
    "La MSA verse les allocations chômage",
    "La MSA gère la retraite des exploitants",
    "La MSA ne rembourse pas les soins",
  ],
  solutions: [],
  targets: ["Vrai", "Faux"],
  expectedTargets: [0, 1, 0, 1],
  penalty: 100,
})

const CATEGORIZE = question({
  type: QUESTION_TYPES.CATEGORIZE,
  question: "Quelle branche verse chaque prestation ?",
  answers: ["Allocations familiales", "Pension", "Indemnités journalières"],
  solutions: [],
  targets: ["Famille", "Retraite", "Maladie"],
  expectedTargets: [0, 1, 2],
})

describe("RoundManager, statements and categorize", () => {
  it("sends the items and their targets, never the right ones", async () => {
    const game = setup([CATEGORIZE], [player("camille")])

    await game.reachFirstQuestion()

    expect(game.lastBroadcast(STATUS.SHOW_PREPARED)?.totalAnswers).toBe(3)
    expect(game.lastBroadcast(STATUS.SHOW_QUESTION)).toMatchObject({
      answers: CATEGORIZE.answers,
      targets: CATEGORIZE.targets,
    })
    expect(game.lastBroadcast(STATUS.SHOW_QUESTION)).not.toHaveProperty(
      "expectedTargets",
    )

    await game.openAnswers(5)

    expect(game.lastBroadcast(STATUS.SELECT_ANSWER)).toMatchObject({
      answers: CATEGORIZE.answers,
      targets: CATEGORIZE.targets,
    })
    expect(game.lastBroadcast(STATUS.SELECT_ANSWER)).not.toHaveProperty(
      "expectedTargets",
    )
  })

  it("scores the share of items matched, with a partial outcome", async () => {
    const game = setup(
      [STATEMENTS],
      [
        player("camille"),
        player("samir"),
        player("yanis", 300),
        player("ines"),
      ],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [0, 1, 0, 1] })
    game.round.selectAnswer(socketOf("samir"), { answerKeys: [0, 1, 1, 1] })
    game.round.selectAnswer(socketOf("yanis"), { answerKeys: [1, 0, 1, 0] })
    await game.closeAnswers()

    // No speed bonus by default: the base is the full 1000 points.
    expect(game.lastSent("camille", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "correct",
      message: "game:correct",
      points: 1000,
    })
    expect(game.lastSent("samir", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "partial",
      correct: true,
      message: "game:partial",
      points: 750,
      matched: { count: 3, total: 4 },
    })
    expect(game.lastSent("yanis", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "wrong",
      points: -100,
      myPoints: 200,
    })

    // Only a partial result explains itself with the items matched.
    for (const name of ["camille", "yanis", "ines"]) {
      expect(game.lastSent(name, STATUS.SHOW_RESULT)).not.toHaveProperty(
        "matched",
      )
    }

    expect(game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)).toMatchObject({
      answers: STATEMENTS.answers,
      targets: ["Vrai", "Faux"],
      expectedTargets: [0, 1, 0, 1],
      totalAnswered: 3,
      correctCount: 1,
      partialCount: 1,
    })
    // Exactly: an extra or missing item would slip through toMatchObject.
    expect(game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)?.responses).toEqual(
      { 0: 2, 1: 2, 2: 1, 3: 2 },
    )

    game.round.showLeaderboard(game.manager)

    expect(game.finished[0]?.questions[0]?.playerAnswers).toEqual([
      { playerName: "camille", answerIds: [0, 1, 0, 1], score: 1 },
      { playerName: "samir", answerIds: [0, 1, 1, 1], score: 0.75 },
      { playerName: "yanis", answerIds: [1, 0, 1, 0], score: 0 },
      { playerName: "ines", answerIds: null, score: 0 },
    ])
  })

  it("gives all or nothing when the scoring is exact", async () => {
    const game = setup(
      [{ ...CATEGORIZE, options: { matchScoring: "exact" } }],
      [player("camille"), player("samir")],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [0, 1, 2] })
    game.round.selectAnswer(socketOf("samir"), { answerKeys: [0, 1, 1] })
    await game.closeAnswers()

    expect(game.lastSent("camille", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "correct",
    })
    expect(game.lastSent("samir", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "wrong",
      points: 0,
    })
    expect(game.lastSent("samir", STATUS.SHOW_RESULT)).not.toHaveProperty(
      "matched",
    )
  })

  it("refuses an answer with an item left out, or a text", async () => {
    const game = setup([CATEGORIZE], [player("camille"), player("yanis")])

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [0, 1] })
    game.round.selectAnswer(socketOf("yanis"), { text: "Famille" })

    expect(game.lastSent("camille", STATUS.WAIT)).toBeUndefined()
    expect(game.lastSent("yanis", STATUS.WAIT)).toBeUndefined()
  })
})

describe("RoundManager, what players receive", () => {
  // Every key a player may receive, per status. Anything else (accepted
  // answers, solutions, the correct order, a clientId) must stay server side.
  const PLAYER_KEYS: Partial<Record<Status, string[]>> = {
    SHOW_START: ["subject", "time"],
    SHOW_PREPARED: ["questionNumber", "questionType", "totalAnswers"],
    SHOW_QUESTION: [
      "answers",
      "cooldown",
      "media",
      "options",
      "question",
      "questionType",
      "targets",
      "text",
      "time",
      "totalPlayer",
      "upcomingMedia",
    ],
    SELECT_ANSWER: [
      "answers",
      "media",
      "options",
      "question",
      "questionType",
      "targets",
      "text",
      "time",
      "totalPlayer",
    ],
    WAIT: ["text"],
    SHOW_RESULT: [
      "correct",
      "found",
      "matched",
      "message",
      "myPoints",
      "outcome",
      "points",
      "rank",
      "totalPlayers",
    ],
    FINISHED: ["rank", "subject", "top", "totalPlayers"],
  }

  it("holds no secret, whitelisted key by key", async () => {
    const game = setup(
      [
        ORDERING,
        { ...SHORTANSWER, options: { typoTolerance: true } },
        ESTIMATE,
        HIGHLIGHT,
        STATEMENTS,
        CATEGORIZE,
        question(),
      ],
      [player("camille"), player("yanis")],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)

    const shown = game.lastBroadcast(STATUS.SELECT_ANSWER)?.answers

    game.round.selectAnswer(socketOf("camille"), {
      answerKeys: keysFor(shown, ITEMS),
    })
    await game.closeAnswers()
    await game.reachNextQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { text: "Lutece" })
    await game.closeAnswers()
    await game.reachNextQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { text: "4200" })
    await game.closeAnswers()
    await game.reachNextQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [0] })
    await game.closeAnswers()
    await game.reachNextQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [0, 1, 1, 1] })
    game.round.selectAnswer(socketOf("yanis"), { answerKeys: [0, 1, 0, 1] })
    await game.closeAnswers()
    await game.reachNextQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [0, 1, 0] })
    await game.closeAnswers()
    await game.reachNextQuestion()
    await game.openAnswers(5)
    await game.closeAnswers()
    game.round.showLeaderboard(game.manager)

    // Broadcasts reach the whole room; sends, anyone but the manager.
    const toPlayers = [
      ...game.broadcasts,
      ...game.sent.filter(({ target }) => target !== MANAGER_ID),
    ]

    expect(toPlayers.length).toBeGreaterThan(10)

    for (const { name, data } of toPlayers) {
      const keys = Object.keys(data as object)

      expect(PLAYER_KEYS[name], name).toBeDefined()
      expect(
        keys.every((key) => PLAYER_KEYS[name]?.includes(key)),
        `${name}: ${keys.join()}`,
      ).toBe(true)
    }

    const serialized = JSON.stringify(toPlayers.map(({ data }) => data))

    expect(serialized).not.toContain("Lutetia")
    expect(serialized).not.toContain("Lutèce")
    expect(serialized).not.toContain("4271")
    expect(serialized).not.toContain("expected")
    expect(serialized).not.toContain("clientId")
    // Partial answers explained, with their counts only.
    expect(serialized).toContain('"matched":{"count":3,"total":4}')
    expect(serialized).toContain('"matched":{"count":2,"total":3}')

    const top = game.lastSent("camille", STATUS.FINISHED)?.top ?? []

    expect(top).toHaveLength(2)
    expect(Object.keys(top[0]).sort()).toEqual([
      "connected",
      "correctInARow",
      "id",
      "points",
      "username",
    ])
    expect(game.lastSent(MANAGER_ID, STATUS.FINISHED)?.top).toEqual(top)
  })
})

describe("RoundManager, reconnection", () => {
  it("keeps the answer given before a reconnection, and no second one", async () => {
    const game = setup([question()], [player("camille"), player("yanis")])

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [1] })

    // What Game.reconnectPlayer does: new socket id, answers remapped.
    const camille = game.roster().find((p) => p.id === "camille")

    if (camille) {
      camille.id = "camille-2"
    }

    game.round.remapPlayer("camille", "camille-2")
    game.round.selectAnswer(socketOf("camille-2"), { answerKeys: [0] })

    expect(game.lastSent("camille-2", STATUS.WAIT)).toBeUndefined()

    await game.closeAnswers()

    expect(game.lastSent("camille-2", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "correct",
    })
    expect(game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)).toMatchObject({
      responses: { 1: 1 },
      totalAnswered: 1,
    })
  })
})

const RANKING = question({
  type: QUESTION_TYPES.RANKING,
  question: "Classez ces chantiers par priorité",
  answers: ["Accueil", "Délais", "Numérique"],
  solutions: [],
  penalty: 100,
})

const SCALE = question({
  type: QUESTION_TYPES.SCALE,
  question: "Cette journée répond-elle à vos attentes ?",
  answers: [],
  solutions: [],
  options: { scaleMin: 1, scaleMax: 5, scaleSkip: true },
})

describe("RoundManager, ranking", () => {
  it("shows the proposals as written and ranks them by rank points", async () => {
    const game = setup(
      [RANKING],
      [player("camille", 300), player("yanis"), player("ines")],
    )

    await game.reachFirstQuestion()

    // No shuffle: the proposals keep the author's order, as a poll's answers.
    expect(game.lastBroadcast(STATUS.SHOW_QUESTION)?.answers).toEqual([
      "Accueil",
      "Délais",
      "Numérique",
    ])

    await game.openAnswers(5)

    game.round.selectAnswer(socketOf("camille"), { answerKeys: [1, 0, 2] })
    game.round.selectAnswer(socketOf("yanis"), { answerKeys: [1, 2, 0] })

    await game.closeAnswers()

    // Nobody is right or wrong, and nobody loses points.
    expect(game.lastSent("camille", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "voted",
      correct: true,
      message: "game:rankingAnswered",
      points: 0,
      myPoints: 300,
    })
    expect(game.lastSent("ines", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "noVote",
      message: "game:noAnswer",
      points: 0,
    })

    const responses = game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)

    expect(responses?.rankPoints).toEqual([1, 4, 1])
    // Keyed by proposal: the players who put each one first.
    expect(responses?.responses).toEqual({ 1: 2 })
    expect(responses).toMatchObject({ totalAnswered: 2, totalPlayers: 3 })
    expect(responses).not.toHaveProperty("correctCount")

    game.round.showLeaderboard(game.manager)

    const [saved] = game.finished[0].questions

    // Nominative, as a poll: each player's order is kept.
    expect(saved.playerAnswers).toEqual([
      { playerName: "camille", answerIds: [1, 0, 2], score: 0 },
      { playerName: "yanis", answerIds: [1, 2, 0], score: 0 },
      { playerName: "ines", answerIds: null, score: 0 },
    ])
  })

  it("refuses an order that leaves a proposal out", async () => {
    const game = setup([RANKING], [player("camille")])

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [1, 0] })
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [0, 0, 1] })
    await game.closeAnswers()

    expect(
      game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)?.totalAnswered,
    ).toBe(0)
  })
})

describe("RoundManager, scale", () => {
  it("counts the levels together and keeps only who answered", async () => {
    const players = ["camille", "yanis", "ines", "lea", "noe"].map((id) =>
      player(id),
    )
    const game = setup([SCALE], players)

    await game.reachFirstQuestion()

    expect(game.lastBroadcast(STATUS.SHOW_PREPARED)?.totalAnswers).toBe(0)
    expect(game.lastBroadcast(STATUS.SHOW_QUESTION)).toMatchObject({
      answers: [],
      options: { scaleMin: 1, scaleMax: 5, scaleSkip: true },
    })

    await game.openAnswers(5)

    game.round.selectAnswer(socketOf("camille"), { answerKeys: [4] })
    game.round.selectAnswer(socketOf("yanis"), { answerKeys: [3] })
    game.round.selectAnswer(socketOf("ines"), { answerKeys: [4] })
    // « Je préfère ne pas répondre »: the index past the last level.
    game.round.selectAnswer(socketOf("lea"), { answerKeys: [5] })

    await game.closeAnswers()

    expect(game.lastSent("camille", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "voted",
      correct: true,
      message: "game:scaleAnswered",
      points: 0,
    })
    expect(game.lastSent("lea", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "voted",
      message: "game:scaleAnswered",
    })
    expect(game.lastSent("noe", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "noVote",
      message: "game:noAnswer",
    })

    const responses = game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)

    expect(responses?.responses).toEqual({ 3: 1, 4: 2, 5: 1 })
    expect(responses).toMatchObject({ totalAnswered: 4, totalPlayers: 5 })

    game.round.showLeaderboard(game.manager)

    const [saved] = game.finished[0].questions

    expect(saved.playerAnswers).toEqual([
      { playerName: "camille", answerIds: [], answered: true, score: 0 },
      { playerName: "yanis", answerIds: [], answered: true, score: 0 },
      { playerName: "ines", answerIds: [], answered: true, score: 0 },
      { playerName: "lea", answerIds: [], answered: true, score: 0 },
      { playerName: "noe", answerIds: null, answered: false, score: 0 },
    ])
    expect(saved.scale).toEqual({ counts: [0, 0, 0, 1, 2], skipped: 1 })
    expect(saved).not.toHaveProperty("scaleWithheld")
  })

  it("keeps no count when too few players answered", async () => {
    const game = setup(
      [SCALE],
      [player("camille"), player("yanis"), player("ines")],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [0] })
    game.round.selectAnswer(socketOf("yanis"), { answerKeys: [4] })
    await game.closeAnswers()

    // The room still sees them.
    expect(game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)?.responses).toEqual(
      { 0: 1, 4: 1 },
    )

    game.round.showLeaderboard(game.manager)

    const [saved] = game.finished[0].questions

    expect(saved.scaleWithheld).toBe(true)
    expect(saved).not.toHaveProperty("scale")
    expect(saved.playerAnswers.filter(({ answered }) => answered)).toHaveLength(
      2,
    )
  })

  it("keeps no count when the only answers preferred not to answer", async () => {
    const game = setup(
      [SCALE],
      [player("camille"), player("yanis"), player("ines")],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    // Without this, the two players who answered would be exactly the two
    // « Je préfère ne pas répondre » the count reports.
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [5] })
    game.round.selectAnswer(socketOf("yanis"), { answerKeys: [5] })
    await game.closeAnswers()

    game.round.showLeaderboard(game.manager)

    const [saved] = game.finished[0].questions

    expect(saved.scaleWithheld).toBe(true)
    expect(saved).not.toHaveProperty("scale")
  })

  it("keeps the counts when a skip makes up the third answer", async () => {
    const game = setup(
      [SCALE],
      [player("camille"), player("yanis"), player("ines")],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [0] })
    game.round.selectAnswer(socketOf("yanis"), { answerKeys: [4] })
    game.round.selectAnswer(socketOf("ines"), { answerKeys: [5] })
    await game.closeAnswers()

    game.round.showLeaderboard(game.manager)

    const [saved] = game.finished[0].questions

    expect(saved.scale).toEqual({ counts: [1, 0, 0, 0, 1], skipped: 1 })
    expect(saved).not.toHaveProperty("scaleWithheld")
  })

  it("refuses a level the scale has not, and a skip not offered", async () => {
    const game = setup(
      [{ ...SCALE, options: { scaleMin: 1, scaleMax: 5 } }],
      [player("camille"), player("yanis"), player("ines")],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)
    game.round.selectAnswer(socketOf("camille"), { answerKeys: [5] })
    game.round.selectAnswer(socketOf("yanis"), { answerKeys: [0, 1] })
    game.round.selectAnswer(socketOf("ines"), { text: "4" })
    await game.closeAnswers()

    expect(
      game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)?.totalAnswered,
    ).toBe(0)
  })
})

const MARKERS = question({
  type: QUESTION_TYPES.MARKERS,
  question: "Où se trouve le point de rassemblement ?",
  media: { type: MEDIA_TYPES.IMAGE, url: "https://msa.example/plan.png" },
  answers: ["Le hangar", "La cour", "Le portail"],
  markers: [
    { x: 20, y: 30 },
    { x: 55, y: 60 },
    { x: 80, y: 15 },
  ],
  solutions: [1],
  options: { scoringMode: "balanced" },
})

describe("RoundManager, markers", () => {
  it("sends the markers with their labels, never which one is right", async () => {
    const game = setup([MARKERS], [player("camille"), player("yanis")])

    await game.reachFirstQuestion()

    const reading = game.lastBroadcast(STATUS.SHOW_QUESTION)

    expect(reading).toMatchObject({
      answers: ["Le hangar", "La cour", "Le portail"],
      markers: MARKERS.markers,
    })
    expect(reading).not.toHaveProperty("solutions")

    await game.openAnswers(5)

    const answering = game.lastBroadcast(STATUS.SELECT_ANSWER)

    expect(answering).toMatchObject({ markers: MARKERS.markers })
    expect(answering).not.toHaveProperty("solutions")
  })

  it("scores the marker tapped and counts them all for the manager", async () => {
    const game = setup(
      [MARKERS],
      [player("camille"), player("yanis"), player("ines")],
    )

    await game.reachFirstQuestion()
    await game.openAnswers(5)

    game.round.selectAnswer(socketOf("camille"), { answerKeys: [1] })
    game.round.selectAnswer(socketOf("yanis"), { answerKeys: [2] })
    // Several markers at once, when only one is right.
    game.round.selectAnswer(socketOf("ines"), { answerKeys: [1, 2] })

    await game.closeAnswers()

    expect(game.lastSent("camille", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "correct",
      correct: true,
    })
    expect(game.lastSent("yanis", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "wrong",
    })
    expect(game.lastSent("ines", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "noAnswer",
    })

    const responses = game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)

    expect(responses?.responses).toEqual({ 1: 1, 2: 1 })
    expect(responses).toMatchObject({
      markers: MARKERS.markers,
      solutions: [1],
      correctCount: 1,
      totalAnswered: 2,
    })

    game.round.showLeaderboard(game.manager)

    const [saved] = game.finished[0].questions

    expect(saved.playerAnswers).toEqual([
      { playerName: "camille", answerIds: [1], score: 1 },
      { playerName: "yanis", answerIds: [2], score: 0 },
      { playerName: "ines", answerIds: null, score: 0 },
    ])
    // The result window places the numbers of its rows on the image again.
    expect(saved.markers).toEqual(MARKERS.markers)
  })

  it("takes several markers when several are right, on the multiple choice's scale", async () => {
    const several = {
      ...MARKERS,
      solutions: [0, 2],
      options: { scoringMode: "balanced" as const, multiple: true },
    }
    const game = setup([several], [player("camille"), player("yanis")])

    await game.reachFirstQuestion()
    await game.openAnswers(5)

    game.round.selectAnswer(socketOf("camille"), { answerKeys: [0, 2] })
    game.round.selectAnswer(socketOf("yanis"), { answerKeys: [0] })

    await game.closeAnswers()

    expect(game.lastSent("camille", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "correct",
    })
    // Half the credit, as on a multiple choice: still a correct outcome.
    expect(game.lastSent("yanis", STATUS.SHOW_RESULT)).toMatchObject({
      outcome: "correct",
    })
    expect(game.lastSent(MANAGER_ID, STATUS.SHOW_RESPONSES)).toMatchObject({
      correctCount: 1,
      partialCount: 1,
    })
  })
})
