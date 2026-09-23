import { EVENTS, MEDIA_TYPES, QUESTION_TYPES } from "@razzia/common/constants"
import type { QuizzWithId } from "@razzia/common/types/game"
import type { Server, Socket } from "@razzia/common/types/game/socket"
import { STATUS } from "@razzia/common/types/game/status"
import Game from "@razzia/socket/services/game"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The registry and the results table stand behind the game: both stubbed.
vi.mock("@razzia/socket/services/registry", () => ({
  default: {
    getInstance: () => ({
      getGameByInviteCode: () => undefined,
      reactivateGame: () => undefined,
    }),
  },
}))
vi.mock("@razzia/socket/repositories/results", () => ({
  saveResult: () => undefined,
}))

interface Emitted {
  target: string
  event: string
  data: unknown
}

const QUIZZ: QuizzWithId = {
  id: "quizz",
  subject: "Quiz de test",
  questions: [
    {
      type: QUESTION_TYPES.SINGLE,
      question: "Combien de temps met la lumière du Soleil ?",
      answers: ["8 secondes", "8 minutes", "8 heures", "8 jours"],
      solutions: [1],
      cooldown: 5,
      time: 20,
    },
  ],
}

// Just enough of socket.io to run a game, recording what reaches each target
// (a room less one socket reads as "room!socket").
const setup = () => {
  const emitted: Emitted[] = []
  const emitTo = (target: string) => ({
    emit: (event: string, data?: unknown) => {
      emitted.push({ target, event, data })

      return true
    },
    except: (excluded: string) => emitTo(`${target}!${excluded}`),
  })
  const io = {
    to: emitTo,
    in: () => ({ socketsLeave: () => undefined }),
  } as unknown as Server
  const socket = (id: string, clientId: string) =>
    ({
      id,
      handshake: { auth: { clientId } },
      join: () => undefined,
      ...emitTo(id),
      to: emitTo,
    }) as unknown as Socket

  const statusesOf = (target: string) =>
    emitted
      .filter((entry) => entry.target === target)
      .filter((entry) => entry.event === EVENTS.GAME.STATUS)
      .map(({ data }) => data as { name: string; data: unknown })

  const eventsOf = (target: string, event: string) =>
    emitted
      .filter((entry) => entry.target === target && entry.event === event)
      .map(({ data }) => data)

  return { io, socket, statusesOf, eventsOf }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, "log").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("Game reconnection", () => {
  it("keeps the answer given before a reconnection, and no second one", async () => {
    const { io, socket, statusesOf } = setup()
    const manager = socket("manager-1", "client-manager")
    const game = new Game(io, manager, QUIZZ)
    const camille = socket("camille-1", "client-camille")
    const yanis = socket("yanis-1", "client-yanis")

    game.join(camille, "Camille")
    game.join(yanis, "Yanis")
    void game.start(manager)
    // Start screen, countdown, question number, then the reading time.
    await vi.advanceTimersByTimeAsync(13_000)

    game.selectAnswer(camille, { answerKeys: [1] })
    game.setPlayerDisconnected("camille-1")

    const camilleBack = socket("camille-2", "client-camille")

    game.reconnect(camilleBack)
    game.selectAnswer(camilleBack, { answerKeys: [0] })

    expect(
      statusesOf("camille-2").some(({ name }) => name === STATUS.WAIT),
    ).toBe(false)

    // Everyone has answered once: the question closes on the next tick.
    game.selectAnswer(yanis, { answerKeys: [2] })
    await vi.advanceTimersByTimeAsync(1000)

    expect(statusesOf("camille-2").at(-1)).toMatchObject({
      name: STATUS.SHOW_RESULT,
      data: { outcome: "correct", rank: 1 },
    })
    expect(statusesOf("manager-1").at(-1)).toMatchObject({
      name: STATUS.SHOW_RESPONSES,
      data: { responses: { 1: 1, 2: 1 }, totalAnswered: 2 },
    })
  })
})

const VIDEO = { type: MEDIA_TYPES.VIDEO, url: "https://intranet.example/v.mp4" }

describe("Game, a video on the projected screen", () => {
  it("gives its address to the manager alone, again after a reconnection", async () => {
    const { io, socket, statusesOf, eventsOf } = setup()
    const manager = socket("manager-1", "client-manager")
    const game = new Game(io, manager, {
      ...QUIZZ,
      questions: [{ ...QUIZZ.questions[0], media: VIDEO }],
    })
    const camille = socket("camille-1", "client-camille")

    game.join(camille, "Camille")
    void game.start(manager)
    // Start screen, countdown, question number, then the reading time.
    await vi.advanceTimersByTimeAsync(13_000)

    // The room but the manager: the type only.
    expect(
      statusesOf(`${game.gameId}!manager-1`).map(({ name, data }) => ({
        name,
        media: (data as { media?: unknown }).media,
      })),
    ).toEqual([
      { name: STATUS.SHOW_QUESTION, media: { type: MEDIA_TYPES.VIDEO } },
      { name: STATUS.SELECT_ANSWER, media: { type: MEDIA_TYPES.VIDEO } },
    ])
    // The manager: the whole media.
    expect(
      statusesOf("manager-1")
        .filter(({ name }) => name !== STATUS.SHOW_RESPONSES)
        .map(({ data }) => (data as { media?: unknown }).media),
    ).toEqual([VIDEO, VIDEO])

    // A reload of the projected screen: the whole media again.
    game.setManagerDisconnected()
    const managerBack = socket("manager-2", "client-manager")

    game.reconnect(managerBack)

    expect(
      eventsOf("manager-2", EVENTS.MANAGER.SUCCESS_RECONNECT),
    ).toMatchObject([
      { status: { name: STATUS.SELECT_ANSWER, data: { media: VIDEO } } },
    ])

    // A player back: the type only.
    game.setPlayerDisconnected("camille-1")
    const camilleBack = socket("camille-2", "client-camille")

    game.reconnect(camilleBack)

    const [camilleStatus] = eventsOf(
      "camille-2",
      EVENTS.PLAYER.SUCCESS_RECONNECT,
    ) as Array<{ status: { name: string; data: { media?: unknown } } }>

    expect(camilleStatus.status.name).toBe(STATUS.SELECT_ANSWER)
    expect(camilleStatus.status.data.media).toEqual({
      type: MEDIA_TYPES.VIDEO,
    })
  })
})

const ON_DEVICES = {
  type: MEDIA_TYPES.VIDEO,
  url: "https://intranet.example/v.mp4",
  playback: "devices" as const,
}

// A slide whose video plays on every device, then a question.
const DEVICES_QUIZZ: QuizzWithId = {
  ...QUIZZ,
  questions: [
    {
      type: QUESTION_TYPES.SLIDE,
      question: "La MSA en vidéo",
      answers: [],
      solutions: [],
      media: ON_DEVICES,
      cooldown: 5,
      time: -1,
    },
    QUIZZ.questions[0],
  ],
}

const devicesGame = async () => {
  const tools = setup()
  const manager = tools.socket("manager-1", "client-manager")
  const game = new Game(tools.io, manager, DEVICES_QUIZZ)
  const camille = tools.socket("camille-1", "client-camille")

  game.join(camille, "Camille")
  void game.start(manager)
  // Start screen, countdown, question number, then the reading time.
  await vi.advanceTimersByTimeAsync(13_000)

  const room = `${game.gameId}!manager-1`
  const statesOf = (target: string) =>
    tools.eventsOf(target, EVENTS.GAME.MEDIA_STATE) as Array<{
      question: number
      playing: boolean
      position: number
      at: number
      seq: number
    }>
  const viewersOf = (target: string) =>
    tools.eventsOf(target, EVENTS.MANAGER.MEDIA_VIEWERS) as Array<{
      question: number
      count: number
    }>

  return { ...tools, game, manager, camille, room, statesOf, viewersOf }
}

describe("Game, a video on every device", () => {
  it("gives the players its address, and where it stands, which the manager alone moves", async () => {
    const { game, manager, camille, room, statusesOf, statesOf } =
      await devicesGame()

    expect(
      statusesOf(room)
        .filter(({ name }) => name === STATUS.SELECT_ANSWER)
        .map(({ data }) => (data as { media?: unknown }).media),
    ).toEqual([ON_DEVICES])
    expect(statesOf(room)).toMatchObject([
      { question: 1, playing: false, position: 0, seq: 1 },
    ])
    // The manager's screen is where the state comes from: none for it.
    expect(statesOf("manager-1")).toEqual([])

    game.controlMedia(manager, {
      gameId: game.gameId,
      playing: true,
      position: 0.4,
    })
    expect(statesOf(room).at(-1)).toMatchObject({
      playing: true,
      position: 0.4,
      seq: 2,
    })

    // A player's forged command: nothing moves.
    await vi.advanceTimersByTimeAsync(1000)
    game.controlMedia(camille, {
      gameId: game.gameId,
      playing: false,
      position: 0,
    })
    await vi.advanceTimersByTimeAsync(1000)
    expect(statesOf(room)).toHaveLength(2)
  })

  it("counts the phones that show it for the manager, and sends them where it stands", async () => {
    const { game, manager, camille, statesOf, viewersOf } = await devicesGame()

    game.controlMedia(manager, {
      gameId: game.gameId,
      playing: true,
      position: 0,
    })
    await vi.advanceTimersByTimeAsync(3000)
    game.watchMedia(camille, true)
    await vi.advanceTimersByTimeAsync(300)

    expect(statesOf("camille-1").at(-1)).toMatchObject({
      playing: true,
      position: 0,
    })
    expect(viewersOf("manager-1").at(-1)).toEqual({ question: 1, count: 1 })

    // Dropped: no longer counted.
    game.setPlayerDisconnected("camille-1")
    await vi.advanceTimersByTimeAsync(300)
    expect(viewersOf("manager-1").at(-1)).toEqual({ question: 1, count: 0 })
  })

  it("pauses it for everyone when the manager's screen goes away", async () => {
    const { game, manager, room, statesOf, viewersOf, socket } =
      await devicesGame()

    game.controlMedia(manager, {
      gameId: game.gameId,
      playing: true,
      position: 2,
    })
    await vi.advanceTimersByTimeAsync(4000)
    game.setManagerDisconnected()

    expect(statesOf(room).at(-1)).toMatchObject({
      playing: false,
      position: 6,
    })

    // Its new screen gets the count again, and moves it again.
    const managerBack = socket("manager-2", "client-manager")

    game.reconnect(managerBack)
    expect(viewersOf("manager-2")).toEqual([{ question: 1, count: 0 }])
    await vi.advanceTimersByTimeAsync(200)
    game.controlMedia(managerBack, {
      gameId: game.gameId,
      playing: true,
      position: 6,
    })
    expect(statesOf(`${game.gameId}!manager-2`).at(-1)).toMatchObject({
      playing: true,
      position: 6,
    })
  })

  it("sends it again to a player who comes back", async () => {
    const { game, manager, socket, statesOf, eventsOf } = await devicesGame()

    game.controlMedia(manager, {
      gameId: game.gameId,
      playing: true,
      position: 1,
    })
    game.setPlayerDisconnected("camille-1")

    const camilleBack = socket("camille-2", "client-camille")

    game.reconnect(camilleBack)

    expect(eventsOf("camille-2", EVENTS.PLAYER.SUCCESS_RECONNECT)).toHaveLength(
      1,
    )
    expect(statesOf("camille-2")).toMatchObject([
      { question: 1, playing: true, position: 1 },
    ])
  })

  it("gives a player who arrives during the video the question and where the video stands", async () => {
    const { game, manager, socket, statusesOf, statesOf } = await devicesGame()

    game.controlMedia(manager, {
      gameId: game.gameId,
      playing: true,
      position: 0,
    })

    const yanis = socket("yanis-1", "client-yanis")

    game.join(yanis, "Yanis")

    expect(statusesOf("yanis-1")).toMatchObject([
      {
        name: STATUS.SELECT_ANSWER,
        data: { question: "La MSA en vidéo", media: ON_DEVICES },
      },
    ])
    expect(statesOf("yanis-1")).toMatchObject([{ question: 1, playing: true }])
  })

  it("gives a player who arrived during the reading time the answers once back, as every player", async () => {
    const tools = setup()
    const manager = tools.socket("manager-1", "client-manager")
    const game = new Game(tools.io, manager, {
      ...QUIZZ,
      questions: [{ ...QUIZZ.questions[0], media: ON_DEVICES }],
    })

    game.join(tools.socket("camille-1", "client-camille"), "Camille")
    void game.start(manager)
    // The reading time.
    await vi.advanceTimersByTimeAsync(10_000)

    const yanis = tools.socket("yanis-1", "client-yanis")

    game.join(yanis, "Yanis")
    expect(tools.statusesOf("yanis-1")).toMatchObject([
      { name: STATUS.SHOW_QUESTION },
    ])

    // The answers open, then Yanis's page reloads.
    await vi.advanceTimersByTimeAsync(3000)
    game.setPlayerDisconnected("yanis-1")
    game.reconnect(tools.socket("yanis-2", "client-yanis"))

    expect(
      tools.eventsOf("yanis-2", EVENTS.PLAYER.SUCCESS_RECONNECT),
    ).toMatchObject([
      { status: { name: STATUS.SELECT_ANSWER, data: { media: ON_DEVICES } } },
    ])
  })

  it("gives a player who arrives once the answers closed nothing but the next question", async () => {
    const tools = setup()
    const manager = tools.socket("manager-1", "client-manager")
    const game = new Game(tools.io, manager, {
      ...QUIZZ,
      questions: [{ ...QUIZZ.questions[0], media: ON_DEVICES }],
    })

    game.join(tools.socket("camille-1", "client-camille"), "Camille")
    void game.start(manager)
    await vi.advanceTimersByTimeAsync(13_000)
    // « Passer »: the timer stops within its second.
    game.abortRound(manager)
    await vi.advanceTimersByTimeAsync(1000)

    const yanis = tools.socket("yanis-1", "client-yanis")

    game.join(yanis, "Yanis")
    expect(tools.statusesOf("yanis-1")).toEqual([])
    expect(tools.eventsOf("yanis-1", EVENTS.GAME.MEDIA_STATE)).toEqual([])
  })

  it("keeps giving a slide's video to a player who arrives on the distribution, until the manager moves on", async () => {
    const { game, manager, socket, statusesOf } = await devicesGame()

    game.abortRound(manager)
    await vi.advanceTimersByTimeAsync(1000)
    game.join(socket("yanis-1", "client-yanis"), "Yanis")
    expect(statusesOf("yanis-1")).toMatchObject([
      { name: STATUS.SELECT_ANSWER },
    ])

    game.showLeaderboard(manager)
    game.join(socket("lou-1", "client-lou"), "Lou")
    expect(statusesOf("lou-1")).toEqual([])
  })

  it("stops it once the manager moves past the distribution, and drops it with the next question", async () => {
    const { game, manager, room, statesOf, socket, statusesOf } =
      await devicesGame()

    game.controlMedia(manager, {
      gameId: game.gameId,
      playing: true,
      position: 0,
    })
    await vi.advanceTimersByTimeAsync(2000)
    // « Passer », then « Suivant »: the video stops on every phone.
    game.abortRound(manager)
    await vi.advanceTimersByTimeAsync(100)
    game.showLeaderboard(manager)

    expect(statesOf(room).at(-1)).toMatchObject({
      playing: false,
      position: 2.1,
    })

    game.controlMedia(manager, {
      gameId: game.gameId,
      playing: true,
      position: 2.1,
    })
    await vi.advanceTimersByTimeAsync(200)
    expect(statesOf(room).at(-1)).toMatchObject({ playing: false })

    // The next question has no such video: a player who arrives now waits
    // for the next status, as always.
    const count = statesOf(room).length

    game.nextRound(manager)
    await vi.advanceTimersByTimeAsync(8000)

    const yanis = socket("yanis-1", "client-yanis")

    game.join(yanis, "Yanis")
    expect(statesOf(room)).toHaveLength(count)
    expect(statusesOf("yanis-1")).toEqual([])
  })
})
