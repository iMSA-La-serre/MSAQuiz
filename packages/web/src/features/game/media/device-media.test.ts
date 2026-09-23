import type { MediaSyncState } from "@razzia/common/types/game"
import type { MediaDriver } from "@razzia/web/features/game/media/controller"
import {
  DeviceMedia,
  type DeviceMediaDeps,
  type DevicePlan,
  STUCK_AFTER,
} from "@razzia/web/features/game/media/device-media"
import { FOLLOW } from "@razzia/web/features/game/media/follow"
import { ServerClock } from "@razzia/web/features/game/media/server-clock"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const PLAN: DevicePlan = {
  key: "game/1/film.mp4",
  question: 1,
  source: { kind: "video", url: "https://msa.example/film.mp4" },
  label: "La MSA en vidéo",
}

const notAllowed = () =>
  Object.assign(new Error("play() needs a gesture"), {
    name: "NotAllowedError",
  })

// A phone's player that moves with the fake clock while it plays, at its
// speed, and records what it is told. `clock` stands for the phone's estimate
// of the server's clock (the server's own time by default).
const fakePhone = ({
  clock,
  ...deps
}: Partial<DeviceMediaDeps> & {
  clock?: (_serverNow: number, _local: number) => number
} = {}) => {
  const calls: string[] = []
  const player = {
    paused: true,
    ended: false,
    position: 0,
    duration: 60 as number | null,
    muted: false,
    rate: 1,
    refuse: false,
    // Plays without saying so (iOS keeping a YouTube player still).
    silent: false,
    created: 0,
    onChange: (): void => undefined,
  }
  let serverNow = 1_790_000_000_000
  let local = 0
  let visible = true

  const create = (_source: unknown, onChange: () => void): MediaDriver => {
    player.created += 1
    player.onChange = onChange

    return {
      element: {} as HTMLElement,
      setLabel: (label) => calls.push(`label ${label}`),
      get paused() {
        return player.paused
      },
      get ended() {
        return player.ended
      },
      get position() {
        return player.position
      },
      get duration() {
        return player.duration
      },
      get failed() {
        return false
      },
      get muted() {
        return player.muted
      },
      play: () => {
        calls.push("play")

        if (player.refuse) {
          return Promise.reject(notAllowed())
        }

        if (player.silent) {
          return new Promise<void>(() => {
            // Never settles.
          })
        }

        player.paused = false
        player.onChange()

        return Promise.resolve()
      },
      pause: () => {
        calls.push("pause")
        player.paused = true
        player.onChange()
      },
      seek: (seconds) => {
        calls.push(`seek ${Math.round(seconds * 100) / 100}`)
        player.position = seconds
        player.onChange()
      },
      setMuted: (muted) => {
        player.muted = muted
        player.onChange()
      },
      setRate: (rate) => {
        calls.push(`rate ${rate}`)
        player.rate = rate
      },
      unlock: () => calls.push("unlock"),
      destroy: () => calls.push("destroy"),
    }
  }

  const media = new DeviceMedia({
    createDriver: create,
    serverNow: () => (clock ? clock(serverNow, local) : serverNow),
    local: () => local,
    visible: () => visible,
    ...deps,
  })

  // Time going by, 100 ms at a time, the player moving if it plays.
  const wait = async (ms: number): Promise<void> => {
    if (ms <= 0) {
      return
    }

    serverNow += 100
    local += 100

    if (!player.paused && !player.ended) {
      player.position += 0.1 * player.rate
    }

    await vi.advanceTimersByTimeAsync(100)
    await wait(ms - 100)
  }

  const word = (over: Partial<MediaSyncState> & { seq: number }) =>
    media.receive({
      question: 1,
      media: {
        type: "video",
        url: "https://msa.example/film.mp4",
        playback: "devices",
      },
      playing: false,
      position: 0,
      at: serverNow,
      ...over,
    })

  return {
    media,
    player,
    calls,
    wait,
    word,
    serverNow: () => serverNow,
    local: () => local,
    hide: (hidden: boolean) => {
      visible = !hidden
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("DeviceMedia, before its user chooses", () => {
  it("loads nothing, whatever the server says", async () => {
    const phone = fakePhone()

    phone.media.show(PLAN)
    phone.word({ seq: 1, playing: true })
    await phone.wait(1000)

    expect(phone.player.created).toBe(0)
    expect(phone.media.getSnapshot()).toMatchObject({
      key: PLAN.key,
      choice: null,
      hostPlaying: true,
    })
  })

  it("loads nothing once its user said « Non, je regarde l'écran »", async () => {
    const phone = fakePhone()

    phone.media.decline(PLAN)
    phone.word({ seq: 1, playing: true })
    await phone.wait(1000)

    expect(phone.player.created).toBe(0)
    expect(phone.media.getSnapshot().choice).toBe("decline")
    expect(phone.media.watching).toBe(false)
  })
})

describe("DeviceMedia, « Regarder ici »", () => {
  it("plays at once, within the tap, where the host is", () => {
    const phone = fakePhone()

    phone.media.show(PLAN)
    phone.word({
      seq: 1,
      playing: true,
      position: 0,
      at: phone.serverNow() - 12_000,
    })
    phone.media.watch(PLAN)

    expect(phone.player.created).toBe(1)
    expect(phone.calls).toEqual([`label ${PLAN.label}`, "seek 12", "play"])
    expect(phone.media.watching).toBe(true)
  })

  it("only unlocks the player within the tap while the host has not played it", () => {
    const phone = fakePhone()

    phone.word({ seq: 1 })
    phone.media.watch(PLAN)

    expect(phone.calls).toEqual([`label ${PLAN.label}`, "unlock"])
    expect(phone.player.paused).toBe(true)
  })

  it("plays and pauses as the host does, where the host does", async () => {
    const phone = fakePhone()

    phone.word({ seq: 1 })
    phone.media.watch(PLAN)
    phone.word({ seq: 2, playing: true, position: 0 })
    await phone.wait(3000)

    expect(phone.player.paused).toBe(false)
    expect(phone.player.position).toBeCloseTo(3, 1)

    phone.word({ seq: 3, playing: false, position: 3.05 })
    expect(phone.player.paused).toBe(true)

    // « Revenir au début », paused.
    phone.word({ seq: 4, playing: false, position: 0 })
    expect(phone.player.position).toBe(0)
    expect(phone.player.paused).toBe(true)
  })

  it("jumps back in step after a stall, and catches up a small gap with its speed", async () => {
    const phone = fakePhone()

    phone.word({ seq: 1, playing: true })
    phone.media.watch(PLAN)
    await phone.wait(2000)

    // The phone's video stalled for two seconds.
    phone.player.position -= 2
    await phone.wait(FOLLOW.TICK)
    expect(phone.player.position).toBeCloseTo(2.5, 1)

    // A little behind: a little faster, until in step again.
    phone.player.position -= 0.2
    await phone.wait(FOLLOW.TICK)
    expect(phone.player.rate).toBe(1 + FOLLOW.SLIGHT_RATE)
    await phone.wait(6000)
    expect(phone.player.rate).toBe(1)
  })

  it("ignores a word it already had, and the word about another question", () => {
    const phone = fakePhone()

    phone.word({ seq: 1 })
    phone.media.watch(PLAN)
    phone.word({ seq: 2, playing: true })
    phone.word({ seq: 2, playing: false })
    phone.word({ seq: 3, question: 2, playing: false })

    expect(phone.player.paused).toBe(false)
    expect(phone.calls.filter((call) => call === "pause")).toEqual([])
  })

  it("plays again a player paused by anything but the host", async () => {
    const phone = fakePhone()

    phone.word({ seq: 1, playing: true })
    phone.media.watch(PLAN)
    phone.player.paused = true
    await phone.wait(FOLLOW.TICK)

    expect(phone.player.paused).toBe(false)
  })

  it("waits for a tap when the browser refuses to play, then plays", async () => {
    const phone = fakePhone()

    phone.player.refuse = true
    phone.word({ seq: 1, playing: true })
    phone.media.watch(PLAN)
    await phone.wait(2000)

    expect(phone.media.controller.getState().blocked).toBe(true)
    expect(phone.calls.filter((call) => call === "play")).toHaveLength(1)

    phone.player.refuse = false
    phone.media.resume()
    await phone.wait(100)
    expect(phone.player.paused).toBe(false)
    expect(phone.media.controller.getState().blocked).toBe(false)
  })

  it("says a player asked to play that never does is stuck", async () => {
    const phone = fakePhone()

    phone.player.silent = true
    phone.word({ seq: 1, playing: true })
    phone.media.watch(PLAN)
    await phone.wait(STUCK_AFTER - 500)
    expect(phone.media.getSnapshot().stuck).toBe(false)

    await phone.wait(1000)
    expect(phone.media.getSnapshot().stuck).toBe(true)

    // The host pauses: nothing to wait for.
    phone.word({ seq: 2, playing: false, position: 4 })
    await phone.wait(FOLLOW.TICK)
    expect(phone.media.getSnapshot().stuck).toBe(false)
  })

  it("pauses in a hidden page and catches up once shown", async () => {
    const phone = fakePhone()

    phone.word({ seq: 1, playing: true })
    phone.media.watch(PLAN)
    await phone.wait(1000)
    phone.hide(true)
    await phone.wait(3000)

    expect(phone.player.paused).toBe(true)

    phone.hide(false)
    phone.media.refresh()
    expect(phone.player.paused).toBe(false)
    expect(phone.player.position).toBeCloseTo(4, 1)
  })

  it("cuts its sound when its user asks, and never pauses for it", () => {
    const phone = fakePhone()

    phone.word({ seq: 1, playing: true })
    phone.media.watch(PLAN)
    phone.media.toggleMute()

    expect(phone.media.controller.getState().muted).toBe(true)
    expect(phone.player.paused).toBe(false)

    phone.media.toggleMute()
    expect(phone.media.controller.getState().muted).toBe(false)
  })

  it("drops the player with the next screen's video, and when leaving the game", () => {
    const phone = fakePhone()

    phone.word({ seq: 1, playing: true })
    phone.media.watch(PLAN)
    phone.media.show({ ...PLAN, key: "game/2/film.mp4", question: 2 })

    expect(phone.calls.at(-1)).toBe("destroy")
    expect(phone.media.getSnapshot()).toMatchObject({
      key: "game/2/film.mp4",
      choice: null,
    })

    phone.media.reset()
    expect(phone.media.getSnapshot()).toMatchObject({
      key: null,
      choice: null,
      hostPlaying: false,
    })
    // A new game counts its words from 1 again.
    phone.word({ seq: 1, playing: true })
    expect(phone.media.getSnapshot().hostPlaying).toBe(false)
    phone.media.show(PLAN)
    expect(phone.media.getSnapshot().hostPlaying).toBe(true)
  })
})

describe("DeviceMedia, « Ne plus regarder ici »", () => {
  it("drops the player, which nothing loads again for the question", async () => {
    const phone = fakePhone()

    phone.word({ seq: 1, playing: true })
    phone.media.watch(PLAN)
    await phone.wait(1000)
    phone.media.decline(PLAN)

    expect(phone.calls.at(-1)).toBe("destroy")
    expect(phone.media.getSnapshot()).toMatchObject({
      key: PLAN.key,
      choice: "decline",
    })
    expect(phone.media.watching).toBe(false)
    expect(phone.media.controller.getState().key).toBeNull()

    const calls = phone.calls.length

    phone.word({ seq: 2, playing: false, position: 4 })
    await phone.wait(2000)
    expect(phone.calls).toHaveLength(calls)
    expect(phone.player.created).toBe(1)
  })
})

describe("DeviceMedia, a tap once the host paused", () => {
  it("plays nothing on its own, and starts again with the host", async () => {
    const phone = fakePhone()

    // Refused without a tap, then paused by the host.
    phone.player.refuse = true
    phone.word({ seq: 1, playing: true })
    phone.media.watch(PLAN)
    await phone.wait(1000)
    phone.word({ seq: 2, playing: false, position: 1 })
    expect(phone.media.controller.getState().blocked).toBe(true)

    phone.player.refuse = false
    phone.media.resume()
    await phone.wait(FOLLOW.TICK)

    expect(phone.player.paused).toBe(true)
    expect(phone.calls.filter((call) => call === "play")).toHaveLength(1)
    expect(phone.media.controller.getState().blocked).toBe(false)

    // The host plays: the phone follows, no tap needed.
    phone.word({ seq: 3, playing: true, position: 1 })
    await phone.wait(FOLLOW.TICK)
    expect(phone.player.paused).toBe(false)
  })
})

describe("DeviceMedia, the server's clock in doubt", () => {
  it("keeps its player as it is until the clock is measured again", async () => {
    let pending = false
    const phone = fakePhone({ clockPending: () => pending })

    phone.word({ seq: 1, playing: true })
    phone.media.watch(PLAN)
    await phone.wait(2000)

    // The connection changed: the phone's player stalled meanwhile.
    pending = true
    phone.player.position -= 2
    await phone.wait(2 * FOLLOW.TICK)
    expect(phone.calls.some((call) => call.startsWith("seek"))).toBe(false)

    // Measured: back where the host is.
    pending = false
    await phone.wait(FOLLOW.TICK)
    expect(phone.player.position).toBeCloseTo(3.5, 1)
  })

  it("never jumps after a reconnection, with a phone 3 s off the server", async () => {
    // The phone's own time is 3 s behind the server's.
    const clock = new ServerClock({
      local: () => phone.local(),
      epoch: () => phone.serverNow() - 3000,
    })
    const phone = fakePhone({
      clock: () => clock.now(),
      clockPending: () => clock.pending,
    })

    clock.record(0, phone.serverNow(), 0)
    phone.word({ seq: 1, playing: true })
    phone.media.watch(PLAN)
    await phone.wait(10_000)
    expect(phone.player.position).toBeCloseTo(10, 1)

    const calls = phone.calls.length

    // A reconnection: in doubt until the next round trip, which comes late.
    clock.doubt()
    await phone.wait(600)
    expect(phone.calls.slice(calls)).toEqual([])
    expect(phone.player.position).toBeCloseTo(10.6, 1)

    clock.record(phone.local(), phone.serverNow(), phone.local())
    await phone.wait(FOLLOW.TICK)
    expect(phone.calls.slice(calls)).toEqual([])
    expect(phone.player.position).toBeCloseTo(11.1, 1)
  })
})
