import { EVENTS, MEDIA_SYNC } from "@razzia/common/constants"
import type {
  MediaSyncState,
  MediaViewers,
  QuestionMedia,
} from "@razzia/common/types/game"
import type { Server, Socket } from "@razzia/common/types/game/socket"
import { MediaSync } from "@razzia/socket/services/game/media-sync"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const MANAGER = "manager-socket"
const FILE: QuestionMedia = {
  type: "video",
  url: "/media/film.mp4",
  playback: "devices",
}
const YOUTUBE: QuestionMedia = {
  type: "youtube",
  url: "https://youtu.be/aqz-KE-bpKQ?t=30",
  playback: "devices",
}

interface Emitted {
  target: string
  event: string
  data: unknown
}

const setup = () => {
  const emitted: Emitted[] = []
  const connected = new Set<string>(["client-a", "client-b"])
  const emitTo = (target: string) => ({
    emit: (event: string, data?: unknown) => {
      emitted.push({ target, event, data })

      return true
    },
    except: (excluded: string) => emitTo(`${target}!${excluded}`),
  })
  const io = { to: emitTo } as unknown as Server
  let managerId = MANAGER
  const sync = new MediaSync({
    io,
    gameId: "game",
    getManagerId: () => managerId,
    isConnected: (clientId) => connected.has(clientId),
  })
  const socket = (id: string) => ({ id }) as unknown as Socket

  const states = (target = `game!${MANAGER}`) =>
    emitted
      .filter((e) => e.target === target && e.event === EVENTS.GAME.MEDIA_STATE)
      .map((e) => e.data as MediaSyncState)

  const viewers = () =>
    emitted
      .filter((e) => e.event === EVENTS.MANAGER.MEDIA_VIEWERS)
      .map((e) => ({ target: e.target, ...(e.data as MediaViewers) }))

  return {
    sync,
    emitted,
    connected,
    socket,
    states,
    viewers,
    setManager: (id: string) => {
      managerId = id
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-09-23T10:00:00Z"))
})

afterEach(() => {
  vi.useRealTimers()
})

describe("MediaSync, a question's video", () => {
  it("stands paused where it starts, sent to the players and not to the host", () => {
    const { sync, states } = setup()

    sync.begin(2, YOUTUBE)

    expect(states()).toEqual([
      {
        question: 2,
        // As the players got it: the link rebuilt, never as pasted.
        media: {
          type: "youtube",
          url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=30s",
          playback: "devices",
        },
        playing: false,
        position: 30,
        at: Date.now(),
        seq: 1,
      },
    ])
    expect(states(MANAGER)).toEqual([])
  })

  it("keeps nothing for a video on the projected screen, nor for a sound", () => {
    const { sync, states } = setup()

    sync.begin(1, { type: "video", url: "/media/film.mp4" })
    sync.begin(2, { type: "audio", url: "/media/son.mp3", playback: "devices" })
    sync.begin(3, undefined)
    // A YouTube link that names no video, stored before the rule.
    sync.begin(4, {
      type: "youtube",
      url: "https://www.youtube.com/@msa",
      playback: "devices",
    })
    sync.control({ id: MANAGER } as Socket, {
      gameId: "game",
      playing: true,
      position: 3,
    })

    expect(sync.getState()).toBeNull()
    expect(states()).toEqual([])
  })

  it("moves as the host says, stamped with the server's clock", () => {
    const { sync, states, socket } = setup()

    sync.begin(1, FILE)
    vi.advanceTimersByTime(1000)
    sync.control(socket(MANAGER), {
      gameId: "game",
      playing: true,
      position: 0,
    })

    const played = states().at(-1)

    expect(played).toMatchObject({ playing: true, position: 0, seq: 2 })
    expect(played?.at).toBe(Date.now())

    // Seven seconds on, it stands at 7.
    vi.advanceTimersByTime(7000)
    expect(sync.positionAt(Date.now())).toBeCloseTo(7)

    sync.control(socket(MANAGER), {
      gameId: "game",
      playing: false,
      position: 7.2,
    })
    expect(states().at(-1)).toMatchObject({
      playing: false,
      position: 7.2,
      seq: 3,
    })
    vi.advanceTimersByTime(5000)
    expect(sync.positionAt(Date.now())).toBe(7.2)
  })

  it("never lets anyone but the host move it", () => {
    const { sync, states, socket } = setup()

    sync.begin(1, FILE)
    sync.control(socket("player-a"), {
      gameId: "game",
      playing: true,
      position: 42,
    })

    expect(states()).toHaveLength(1)
    expect(sync.getState()).toMatchObject({ playing: false, position: 0 })
  })

  it("sends a burst of commands once, as it stands at the end", () => {
    const { sync, states, socket } = setup()

    sync.begin(1, FILE)
    vi.advanceTimersByTime(MEDIA_SYNC.STATE_INTERVAL)
    sync.control(socket(MANAGER), {
      gameId: "game",
      playing: true,
      position: 0,
    })
    sync.control(socket(MANAGER), {
      gameId: "game",
      playing: false,
      position: 1,
    })
    sync.control(socket(MANAGER), {
      gameId: "game",
      playing: true,
      position: 2,
    })

    // The first at once, the last once the interval is over.
    expect(states().map(({ seq }) => seq)).toEqual([1, 2])
    vi.advanceTimersByTime(MEDIA_SYNC.STATE_INTERVAL)
    expect(states().at(-1)).toMatchObject({
      playing: true,
      position: 2,
      seq: 4,
    })
    expect(states()).toHaveLength(3)
  })

  it("pauses for everyone where it stands when the host's screen goes away", () => {
    const { sync, states, socket } = setup()

    sync.begin(1, FILE)
    sync.control(socket(MANAGER), {
      gameId: "game",
      playing: true,
      position: 4,
    })
    vi.advanceTimersByTime(2500)
    sync.pause()

    expect(states().at(-1)).toMatchObject({ playing: false, position: 6.5 })

    // Already paused: nothing more to send.
    const count = states().length

    sync.pause()
    vi.advanceTimersByTime(1000)
    expect(states()).toHaveLength(count)
  })

  it("stops for good once the host moves past the distribution", () => {
    const { sync, states, socket } = setup()

    sync.begin(1, FILE)
    sync.control(socket(MANAGER), {
      gameId: "game",
      playing: true,
      position: 0,
    })
    vi.advanceTimersByTime(3000)
    sync.end()
    vi.advanceTimersByTime(1000)
    sync.control(socket(MANAGER), {
      gameId: "game",
      playing: true,
      position: 3,
    })
    vi.advanceTimersByTime(1000)

    expect(states().at(-1)).toMatchObject({ playing: false, position: 3 })
    expect(sync.getState()?.playing).toBe(false)
  })

  it("starts over, paused and uncounted, with the next question", () => {
    const { sync, states, socket } = setup()

    sync.begin(1, FILE)
    sync.control(socket(MANAGER), {
      gameId: "game",
      playing: true,
      position: 0,
    })
    sync.watch("client-a", "player-a", true)
    vi.advanceTimersByTime(5000)
    sync.begin(2, YOUTUBE)

    expect(states().at(-1)).toMatchObject({
      question: 2,
      playing: false,
      position: 30,
    })
  })
})

describe("MediaSync, the phones", () => {
  it("sends where it stands to a phone that starts showing it", () => {
    const { sync, states, socket } = setup()

    sync.begin(1, FILE)
    sync.control(socket(MANAGER), {
      gameId: "game",
      playing: true,
      position: 0,
    })
    vi.advanceTimersByTime(4000)
    sync.watch("client-a", "player-a", true)

    // As it stood when last moved: the phone counts the time gone by since.
    expect(states("player-a")).toEqual([sync.getState()])
    expect(states("player-a")[0]).toMatchObject({ playing: true, position: 0 })
  })

  it("sends it to a player who comes back, who is counted once the phone says so", () => {
    const { sync, states, viewers } = setup()

    sync.begin(1, FILE)
    sync.watch("client-a", "player-a", true)
    vi.advanceTimersByTime(MEDIA_SYNC.VIEWERS_INTERVAL)
    sync.playerBack("client-a", "player-a2")
    vi.advanceTimersByTime(MEDIA_SYNC.VIEWERS_INTERVAL)

    expect(states("player-a2")).toEqual([sync.getState()])
    expect(viewers().map(({ count }) => count)).toEqual([0, 1, 0])

    sync.watch("client-a", "player-a2", true)
    vi.advanceTimersByTime(MEDIA_SYNC.VIEWERS_INTERVAL)
    expect(viewers().at(-1)).toMatchObject({ count: 1 })
  })

  it("tells the host how many connected phones show it, never who", () => {
    const { sync, viewers, connected } = setup()

    sync.begin(3, FILE)
    sync.watch("client-a", "player-a", true)
    sync.watch("client-b", "player-b", true)
    vi.advanceTimersByTime(MEDIA_SYNC.VIEWERS_INTERVAL)

    expect(viewers()).toEqual([
      { target: MANAGER, question: 3, count: 0 },
      { target: MANAGER, question: 3, count: 1 },
      { target: MANAGER, question: 3, count: 2 },
    ])

    connected.delete("client-b")
    sync.refreshViewers()
    vi.advanceTimersByTime(MEDIA_SYNC.VIEWERS_INTERVAL)
    sync.watch("client-a", "player-a", false)
    vi.advanceTimersByTime(MEDIA_SYNC.VIEWERS_INTERVAL)

    expect(viewers().map(({ count }) => count)).toEqual([0, 1, 2, 1, 0])
  })

  it("counts nothing while no question plays a video on every device", () => {
    const { sync, viewers, states } = setup()

    sync.begin(1, undefined)
    sync.watch("client-a", "player-a", true)
    sync.refreshViewers()
    sync.managerBack()
    vi.advanceTimersByTime(1000)

    expect(viewers()).toEqual([])
    expect(states("player-a")).toEqual([])
  })

  it("tells the host's new screen the count again", () => {
    const { sync, viewers, setManager } = setup()

    sync.begin(1, FILE)
    sync.watch("client-a", "player-a", true)
    vi.advanceTimersByTime(MEDIA_SYNC.VIEWERS_INTERVAL)
    setManager("manager-2")
    sync.managerBack()

    expect(viewers().at(-1)).toEqual({
      target: "manager-2",
      question: 1,
      count: 1,
    })
  })
})
