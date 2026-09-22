import { EVENTS } from "@razzia/common/constants"
import type { Socket } from "@razzia/common/types/game/socket"
import { guardSocket, isValidClientEvent } from "@razzia/socket/utils/socket"
import { afterEach, describe, expect, it, vi } from "vitest"

type Listener = (..._args: unknown[]) => unknown
type Middleware = (_packet: unknown[], _next: () => void) => void

// Just enough of a socket.io socket to observe what guardSocket installs.
const fakeSocket = () => {
  const listeners = new Map<string, Listener>()
  let middleware: Middleware | null = null

  const socket = {
    id: "socket-1",
    use: (fn: Middleware) => {
      middleware = fn
    },
    on: (event: string, listener: Listener) => {
      listeners.set(event, listener)

      return socket
    },
  }

  guardSocket(socket as unknown as Socket)

  return {
    socket: socket as unknown as Socket,
    trigger: (event: string, ...args: unknown[]) =>
      listeners.get(event)?.(...args),
    // Whether the packet is passed on to the handlers.
    passes: (packet: unknown[]) => {
      let passed = false

      middleware?.(packet, () => {
        passed = true
      })

      return passed
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("isValidClientEvent", () => {
  it("accepts what the web client sends", () => {
    expect(isValidClientEvent(EVENTS.PLAYER.RECONNECT, { gameId: "g" })).toBe(
      true,
    )
    expect(
      isValidClientEvent(EVENTS.PLAYER.SELECTED_ANSWER, {
        gameId: "g",
        data: { answerKeys: [0, 2] },
      }),
    ).toBe(true)
    expect(
      isValidClientEvent(EVENTS.PLAYER.LOGIN, {
        gameId: "g",
        data: { username: "Camille" },
      }),
    ).toBe(true)
    expect(
      isValidClientEvent(EVENTS.MANAGER.KICK_PLAYER, {
        gameId: "g",
        playerId: "p",
      }),
    ).toBe(true)
    expect(
      isValidClientEvent(EVENTS.QUIZZ.UPDATE, {
        id: "q",
        subject: "Quiz",
        questions: [],
      }),
    ).toBe(true)
    expect(isValidClientEvent(EVENTS.MANAGER.GET_CONFIG, undefined)).toBe(true)
    expect(isValidClientEvent(EVENTS.RESULTS.EXPORT, "r")).toBe(true)
  })

  it("follows the declared types for an optional game id", () => {
    expect(isValidClientEvent(EVENTS.MANAGER.START_GAME, {})).toBe(true)
    expect(
      isValidClientEvent(EVENTS.MANAGER.START_GAME, { gameId: null }),
    ).toBe(false)
  })

  it("refuses a missing or malformed payload", () => {
    expect(isValidClientEvent(EVENTS.PLAYER.RECONNECT, undefined)).toBe(false)
    expect(isValidClientEvent(EVENTS.PLAYER.RECONNECT, null)).toBe(false)
    expect(isValidClientEvent(EVENTS.PLAYER.RECONNECT, { gameId: 1 })).toBe(
      false,
    )
    expect(
      isValidClientEvent(EVENTS.MANAGER.KICK_PLAYER, { gameId: "g" }),
    ).toBe(false)
    expect(isValidClientEvent(EVENTS.PLAYER.LOGIN, { gameId: "g" })).toBe(false)
    expect(
      isValidClientEvent(EVENTS.PLAYER.SELECTED_ANSWER, {
        gameId: "g",
        data: { answerKeys: "0" },
      }),
    ).toBe(false)
    expect(isValidClientEvent(EVENTS.QUIZZ.GET, { id: "q" })).toBe(false)
  })

  it("refuses an answer list that is too long or holds something else than numbers", () => {
    const answer = (keys: unknown[]) =>
      isValidClientEvent(EVENTS.PLAYER.SELECTED_ANSWER, {
        gameId: "g",
        data: { answerKeys: keys },
      })

    expect(answer(Array.from({ length: 101 }, () => 0))).toBe(false)
    expect(answer([0, "1"])).toBe(false)
  })

  it("refuses a huge answer list without inspecting every element", () => {
    // About what fits in one 5 MB packet.
    const keys = Array.from({ length: 1_500_000 }, () => "")
    const start = performance.now()

    expect(
      isValidClientEvent(EVENTS.PLAYER.SELECTED_ANSWER, {
        gameId: "g",
        data: { answerKeys: keys },
      }),
    ).toBe(false)
    expect(performance.now() - start).toBeLessThan(100)
  })

  it("refuses events the client never sends", () => {
    expect(isValidClientEvent("nimporte:quoi", {})).toBe(false)
    expect(isValidClientEvent("toString", {})).toBe(false)
    expect(isValidClientEvent("disconnect", undefined)).toBe(false)
    expect(isValidClientEvent(42, {})).toBe(false)
  })
})

describe("guardSocket", () => {
  it("drops a malformed packet before any handler", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const { passes } = fakeSocket()

    expect(passes([EVENTS.PLAYER.RECONNECT, { gameId: "g" }])).toBe(true)
    expect(passes([EVENTS.PLAYER.RECONNECT])).toBe(false)
    expect(passes(["nimporte:quoi", {}])).toBe(false)
  })

  it("keeps the process alive when a handler throws", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const { socket, trigger } = fakeSocket()

    socket.on(EVENTS.PLAYER.RECONNECT, ({ gameId }) => {
      throw new Error(`boom ${gameId}`)
    })

    expect(() =>
      trigger(EVENTS.PLAYER.RECONNECT, { gameId: "g" }),
    ).not.toThrow()
    expect(error).toHaveBeenCalledOnce()
  })

  it("still runs a handler that works", () => {
    const { socket, trigger } = fakeSocket()
    const handler = vi.fn()

    socket.on(EVENTS.PLAYER.LEAVE, handler)
    trigger(EVENTS.PLAYER.LEAVE, { gameId: "g" })

    expect(handler).toHaveBeenCalledWith({ gameId: "g" })
  })
})

describe("isValidClientEvent, shortanswer text", () => {
  const answer = (data: unknown) =>
    isValidClientEvent(EVENTS.PLAYER.SELECTED_ANSWER, { gameId: "g", data })

  it("accepts a text instead of indices", () => {
    expect(answer({ text: "Lutèce" })).toBe(true)
    expect(answer({ text: "" })).toBe(true)
  })

  it("refuses a text over 200 characters, before reading it", () => {
    expect(answer({ text: "a".repeat(200) })).toBe(true)
    expect(answer({ text: "a".repeat(201) })).toBe(false)
  })

  it("refuses a text that is not a string", () => {
    expect(answer({ text: 42 })).toBe(false)
    expect(answer({ text: ["Lutèce"] })).toBe(false)
    expect(answer({ text: null })).toBe(false)
  })

  it("takes indices or a text, never both, never none", () => {
    expect(answer({ answerKeys: [0], text: "Lutèce" })).toBe(false)
    expect(answer({})).toBe(false)
  })

  it("refuses a huge text without reading it", () => {
    const text = "a".repeat(5_000_000)
    const start = performance.now()

    expect(answer({ text })).toBe(false)
    expect(performance.now() - start).toBeLessThan(100)
  })
})
