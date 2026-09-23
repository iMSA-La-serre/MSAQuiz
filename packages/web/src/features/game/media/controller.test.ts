import {
  type MediaDriver,
  MediaController,
  type MediaSource,
  type PlaybackMemory,
  type PlaybackMemoryEntry,
} from "@razzia/web/features/game/media/controller"
import { describe, expect, it, vi } from "vitest"

const VIDEO: MediaSource = {
  kind: "video",
  url: "https://intranet.example/consignes.mp4",
}

const notAllowed = () =>
  Object.assign(new Error("play() needs a gesture"), {
    name: "NotAllowedError",
  })

type Kept = { key: string } & PlaybackMemoryEntry

// A player that does what it is told at once, as a loaded file does, and can
// be told to refuse playing (a browser's autoplay policy).
const fakePlayer = () => {
  const player = {
    paused: true,
    ended: false,
    position: 0,
    duration: 40 as number | null,
    failed: false,
    failure: null as string | null,
    refuse: false,
    created: 0,
    destroyed: 0,
    onChange: (): void => undefined,
  }

  const create = (): MediaDriver => {
    player.created += 1
    player.paused = true
    player.ended = false
    player.position = 0

    return {
      element: { id: player.created } as unknown as HTMLElement,
      setLabel: () => undefined,
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
        return player.failed
      },
      get failure() {
        return player.failure
      },
      play: () => {
        if (player.refuse) {
          return Promise.reject(notAllowed())
        }

        player.paused = false
        player.ended = false
        player.onChange()

        return Promise.resolve()
      },
      pause: () => {
        player.paused = true
        player.onChange()
      },
      seek: (seconds) => {
        player.position = seconds
        player.onChange()
      },
      destroy: () => {
        player.destroyed += 1
      },
    }
  }

  // Time passing while it plays.
  const tick = (position: number) => {
    player.position = position
    player.onChange()
  }

  const end = () => {
    player.position = player.duration ?? 0
    player.paused = true
    player.ended = true
    player.onChange()
  }

  return { player, create, tick, end }
}

const fakeMemory = () => {
  const writes: Kept[] = []
  let kept: Kept | null = null
  const memory: PlaybackMemory = {
    read: (key) =>
      kept?.key === key
        ? {
            position: kept.position,
            playing: kept.playing,
            played: kept.played,
          }
        : null,
    write: (key, entry) => {
      kept = { key, ...entry }
      writes.push(kept)
    },
    clear: () => {
      kept = null
    },
  }

  return { memory, writes, kept: () => kept }
}

const setup = (saved?: Kept) => {
  const fake = fakePlayer()
  const store = fakeMemory()

  if (saved) {
    store.memory.write(saved.key, saved)
    store.writes.length = 0
  }

  const controller = new MediaController((_source, onChange) => {
    fake.player.onChange = onChange

    return fake.create()
  }, store.memory)

  return { ...fake, ...store, controller }
}

// Lets the play() promises settle.
const settle = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe("MediaController", () => {
  it("loads a question's media once, and starts it once", async () => {
    const { controller, player } = setup()

    controller.load("q1", VIDEO)
    controller.load("q1", VIDEO)
    expect(player.created).toBe(1)
    expect(controller.getState()).toMatchObject({
      key: "q1",
      source: VIDEO,
      playing: false,
      started: false,
    })

    // Answers open: it starts.
    controller.autoplay()
    await settle()
    expect(controller.getState()).toMatchObject({
      playing: true,
      started: true,
    })

    // The host pauses it; the distribution does not start it again.
    controller.pause()
    controller.autoplay()
    await settle()
    expect(controller.getState().playing).toBe(false)
  })

  it("never starts a media the host already played during the reading", async () => {
    const { controller, player } = setup()

    controller.load("q1", VIDEO)
    await controller.play()
    controller.pause()
    controller.autoplay()
    await settle()

    expect(player.paused).toBe(true)
  })

  it("follows the player: position, length, end", () => {
    const { controller, tick, end } = setup()
    const listener = vi.fn()

    controller.subscribe(listener)
    controller.load("q1", VIDEO)
    void controller.play()
    tick(12.5)

    expect(controller.getState()).toMatchObject({
      playing: true,
      position: 12.5,
      duration: 40,
    })
    expect(listener).toHaveBeenCalled()

    end()
    expect(controller.getState()).toMatchObject({
      playing: false,
      ended: true,
      position: 40,
    })
  })

  it("keeps the same state while nothing changes", () => {
    const { controller, tick } = setup()

    controller.load("q1", VIDEO)
    tick(3)

    const state = controller.getState()

    tick(3)
    expect(controller.getState()).toBe(state)
  })

  it("goes back to the start, playing on or paused as it was", async () => {
    const { controller, tick } = setup()

    controller.load("q1", VIDEO)
    await controller.play()
    tick(20)
    controller.restart()
    expect(controller.getState()).toMatchObject({ position: 0, playing: true })

    controller.pause()
    tick(8)
    controller.restart()
    expect(controller.getState()).toMatchObject({
      position: 0,
      playing: false,
    })
  })

  it("goes back to where a YouTube link says the video starts", async () => {
    const { controller, tick } = setup()

    controller.load("q1", {
      kind: "youtube",
      url: "https://youtu.be/wIJE-WNenXA?t=30",
      start: 30,
    })
    await controller.play()
    tick(75)
    controller.restart()

    expect(controller.getState()).toMatchObject({ position: 30, playing: true })
  })

  it("says why a player failed, when it tells", () => {
    const { controller, player, tick } = setup()

    controller.load("q1", VIDEO)
    expect(controller.getState().failure).toBeNull()

    player.failed = true
    player.failure = "notEmbeddable"
    tick(0)

    expect(controller.getState()).toMatchObject({
      failed: true,
      failure: "notEmbeddable",
    })
  })

  it("toggles between play and pause", async () => {
    const { controller } = setup()

    controller.load("q1", VIDEO)
    controller.toggle()
    await settle()
    expect(controller.getState().playing).toBe(true)
    controller.toggle()
    expect(controller.getState().playing).toBe(false)
  })

  it("says when the browser refuses to play, until the host plays it", async () => {
    const { controller, player, kept } = setup()

    player.refuse = true
    controller.load("q1", VIDEO)
    controller.autoplay()
    await settle()

    expect(controller.getState()).toMatchObject({
      playing: false,
      blocked: true,
      started: true,
      // Never played: « Lancer la vidéo », not « Reprendre ».
      played: false,
    })
    // The host still wants it playing: a reload tries again.
    expect(kept()).toMatchObject({ key: "q1", playing: true, played: false })

    // A click on « Lancer la vidéo ».
    player.refuse = false
    await controller.play()
    expect(controller.getState()).toMatchObject({
      playing: true,
      blocked: false,
      played: true,
    })
    expect(kept()).toMatchObject({ playing: true, played: true })
  })

  it("says after a reload whether the media had played", async () => {
    const { controller, player } = setup({
      key: "q1",
      position: 12,
      playing: true,
      played: true,
    })

    player.refuse = true
    controller.load("q1", VIDEO)
    await settle()

    // « Reprendre la vidéo », where it was.
    expect(controller.getState()).toMatchObject({
      blocked: true,
      played: true,
      position: 12,
    })
  })

  it("still starts with the answers after a reload a media the host only rewound", async () => {
    const first = setup()

    // The reading time: « Revenir au début » before anything played.
    first.controller.load("q1", VIDEO)
    first.controller.restart()
    expect(first.kept()).toMatchObject({
      position: 0,
      playing: false,
      played: false,
    })

    // The projected screen reloads, then answers open.
    const { controller, player } = setup(first.kept() ?? undefined)

    controller.load("q1", VIDEO)
    expect(controller.getState().started).toBe(false)
    controller.autoplay()
    await settle()

    expect(player.paused).toBe(false)
    expect(controller.getState()).toMatchObject({
      playing: true,
      blocked: false,
    })
  })

  it("picks up after a reload where the host was, playing again", async () => {
    const { controller, player } = setup({
      key: "q1",
      position: 12,
      playing: true,
      played: true,
    })

    controller.load("q1", VIDEO)
    await settle()

    expect(player.position).toBe(12)
    expect(controller.getState()).toMatchObject({
      position: 12,
      playing: true,
      started: true,
    })
  })

  it("picks up a paused media paused, and never starts it on its own", async () => {
    const { controller, player } = setup({
      key: "q1",
      position: 7,
      playing: false,
      played: true,
    })

    controller.load("q1", VIDEO)
    controller.autoplay()
    await settle()

    expect(player.paused).toBe(true)
    expect(controller.getState()).toMatchObject({ position: 7, started: true })
  })

  it("ignores what was kept for another question", () => {
    const { controller, player } = setup({
      key: "q1",
      position: 12,
      playing: true,
      played: true,
    })

    controller.load("q2", VIDEO)

    expect(player.position).toBe(0)
    expect(controller.getState().started).toBe(false)
  })

  it("keeps the position about every second, and each command at once", async () => {
    const { controller, tick, end, writes } = setup()

    controller.load("q1", VIDEO)
    await controller.play()
    writes.length = 0

    for (const position of [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]) {
      tick(position)
    }

    expect(writes.map(({ position }) => position)).toEqual([1, 2])

    controller.pause()
    expect(writes.at(-1)).toMatchObject({ position: 2, playing: false })

    await controller.play()
    end()
    // Its end: nothing left to play after a reload.
    expect(writes.at(-1)).toMatchObject({ position: 40, playing: false })
  })

  it("drops the player of the previous question for the next one", async () => {
    const { controller, player } = setup()

    controller.load("q1", VIDEO)
    await controller.play()
    controller.load("q2", { kind: "audio", url: "/media/son.mp3" })

    expect(player.destroyed).toBe(1)
    expect(controller.getState()).toMatchObject({
      key: "q2",
      playing: false,
      started: false,
    })
  })

  it("forgets the media once its question is over, not when released", async () => {
    const { controller, player, kept } = setup()

    controller.load("q1", VIDEO)
    await controller.play()

    controller.release()
    expect(player.destroyed).toBe(1)
    expect(controller.getState().key).toBeNull()
    expect(kept()).not.toBeNull()

    // Mounted again (a development re-render): where it was.
    controller.load("q1", VIDEO)
    await settle()
    expect(controller.getState()).toMatchObject({ playing: true })

    controller.finish()
    expect(player.destroyed).toBe(2)
    expect(kept()).toBeNull()
    expect(controller.getState().element).toBeNull()
  })

  it("ignores a refusal that comes after the player was dropped", async () => {
    const { controller, player } = setup()

    player.refuse = true
    controller.load("q1", VIDEO)

    const playing = controller.play()

    controller.finish()
    await playing

    expect(controller.getState()).toMatchObject({ key: null, blocked: false })
  })

  it("loads a media that failed again, where the host was", async () => {
    const { controller, player, tick } = setup()

    controller.load("q1", VIDEO)
    await controller.play()
    tick(5)
    controller.pause()
    player.failed = true
    tick(5)
    expect(controller.getState().failed).toBe(true)

    player.failed = false
    controller.retry()

    expect(player.created).toBe(2)
    expect(controller.getState()).toMatchObject({
      key: "q1",
      failed: false,
      position: 5,
    })
  })

  it("does nothing without a media", async () => {
    const { controller } = setup()
    const state = controller.getState()

    controller.autoplay()
    controller.pause()
    controller.toggle()
    controller.restart()
    controller.retry()
    await controller.play()

    expect(controller.getState()).toBe(state)
  })
})
