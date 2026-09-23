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
