import type {
  MediaDriver,
  MediaSource,
} from "@razzia/web/features/game/media/controller"
import {
  READY_TIMEOUT,
  YOUTUBE_STATE,
  type YoutubeApi,
  type YoutubePlayerOptions,
} from "@razzia/web/features/game/media/youtube-api"
import {
  handFocusBack,
  POLL_INTERVAL,
  youtubeDriver,
} from "@razzia/web/features/game/media/youtube-driver"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const SOURCE: MediaSource = {
  kind: "youtube",
  url: "https://youtu.be/wIJE-WNenXA?t=12",
  start: 12,
}

// YouTube's player, as far as the driver uses it: it records the commands,
// and the test plays its events (ready, states, errors).
const fakeYoutube = ({
  fails = false,
  pageStatus,
}: {
  fails?: boolean
  pageStatus?: (_watchUrl: string) => Promise<number | null>
} = {}) => {
  const calls: string[] = []
  const frame = { title: "YouTube video player" } as HTMLIFrameElement
  let options: YoutubePlayerOptions | null = null
  const player = {
    time: 0,
    duration: 140,
    // What it says when asked (getPlayerState).
    state: YOUTUBE_STATE.UNSTARTED as number,
    playVideo: () => calls.push("play"),
    pauseVideo: () => calls.push("pause"),
    seekTo: (seconds: number) => calls.push(`seek ${seconds}`),
    cueVideoById: ({ startSeconds }: { startSeconds?: number }) =>
      calls.push(`cue ${startSeconds}`),
    loadVideoById: ({ startSeconds }: { startSeconds?: number }) =>
      calls.push(`load ${startSeconds}`),
    getCurrentTime: () => player.time,
    getDuration: () => player.duration,
    getPlayerState: () => player.state,
    getIframe: () => frame,
    destroy: () => calls.push("destroy"),
  }
  const api = {
    Player: function Player(_mount: HTMLElement, given: YoutubePlayerOptions) {
      options = given

      return player
    },
  } as unknown as YoutubeApi
  const loadApi = vi.fn(() =>
    fails ? Promise.reject(new Error("offline")) : Promise.resolve(api),
  )
  const removeBox = vi.fn()
  const box = { remove: removeBox, isConnected: true } as unknown as HTMLElement
  const unwatch = vi.fn()
  const watchFrame = vi.fn(() => unwatch)
  const onChange = vi.fn()

  const create = (source: MediaSource = SOURCE): MediaDriver =>
    youtubeDriver({
      loadApi,
      createBox: () => ({ box, mount: {} as HTMLElement }),
      playerVars: (start) => ({ start }),
      watchFrame,
      pageStatus,
    })(source, onChange)

  const events = () => {
    if (!options) {
      throw new Error("no player yet")
    }

    return options.events
  }

  return {
    calls,
    frame,
    player,
    box,
    removeBox,
    loadApi,
    watchFrame,
    unwatch,
    onChange,
    create,
    options: () => options,
    ready: () => events().onReady?.(),
    state: (data: number) => events().onStateChange?.({ data }),
    error: (data: number) => events().onError?.({ data }),
    blocked: () => events().onAutoplayBlocked?.(),
  }
}

// Lets the loading of the API and the play() promises settle.
const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe("youtubeDriver", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("creates YouTube's player for the link's video, from where it starts", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    expect(driver.element).toBe(yt.box)
    expect(driver).toMatchObject({
      paused: true,
      ended: false,
      position: 12,
      duration: null,
      failed: false,
    })

    await flush()

    expect(yt.options()).toMatchObject({
      host: "https://www.youtube-nocookie.com",
      videoId: "wIJE-WNenXA",
      playerVars: { start: 12 },
    })

    yt.ready()
    yt.state(YOUTUBE_STATE.CUED)

    expect(driver.duration).toBe(140)
    expect(driver.position).toBe(12)
    expect(yt.calls).toEqual([])
    expect(yt.watchFrame).toHaveBeenCalledWith(yt.frame)
  })

  it("tells the length in whole seconds, as YouTube's bar does", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    await flush()
    yt.player.duration = 139.94
    yt.ready()

    expect(driver.duration).toBe(140)
    yt.player.duration = 0
    expect(driver.duration).toBeNull()
  })

  it("names the player's frame by the question", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    driver.setLabel("La MSA, c'est quoi ?")
    await flush()
    yt.ready()

    expect(yt.frame.title).toBe("La MSA, c'est quoi ?")
    driver.setLabel("Autre question")
    expect(yt.frame.title).toBe("Autre question")
  })

  it("plays once ready, and says so once YouTube plays", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()
    const played = vi.fn()

    void driver.play().then(played)
    await flush()
    expect(yt.calls).toEqual([])

    yt.ready()
    expect(yt.calls).toEqual(["play"])

    yt.state(YOUTUBE_STATE.BUFFERING)
    expect(driver.paused).toBe(false)
    await flush()
    expect(played).not.toHaveBeenCalled()

    yt.player.time = 12.4
    yt.state(YOUTUBE_STATE.PLAYING)
    await flush()

    expect(played).toHaveBeenCalled()
    expect(driver).toMatchObject({ paused: false, position: 12.4 })
  })

  it("rejects a play the browser blocks, as a NotAllowedError", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    await flush()
    yt.ready()
    yt.state(YOUTUBE_STATE.CUED)

    const played = driver.play()

    yt.state(YOUTUBE_STATE.UNSTARTED)
    yt.blocked()

    await expect(played).rejects.toMatchObject({ name: "NotAllowedError" })
    expect(driver.paused).toBe(true)
  })

  it("pauses, and a play still waiting gives way", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    await flush()
    yt.ready()

    const played = driver.play()

    driver.pause()

    await expect(played).rejects.toMatchObject({ name: "AbortError" })
    expect(yt.calls).toEqual(["play", "pause"])
  })

  it("follows YouTube's own bar: play, pause, end", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    await flush()
    yt.ready()
    yt.state(YOUTUBE_STATE.PLAYING)
    expect(driver.paused).toBe(false)

    yt.state(YOUTUBE_STATE.PAUSED)
    expect(driver.paused).toBe(true)

    yt.player.time = 140
    yt.state(YOUTUBE_STATE.ENDED)
    expect(driver).toMatchObject({ paused: true, ended: true, position: 140 })
  })

  it("reads the position while the player exists, and tells each time", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    await flush()
    yt.ready()
    yt.state(YOUTUBE_STATE.PLAYING)
    yt.onChange.mockClear()

    yt.player.time = 13
    vi.advanceTimersByTime(POLL_INTERVAL)
    expect(driver.position).toBe(13)
    expect(yt.onChange).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(POLL_INTERVAL * 3)
    expect(yt.onChange).toHaveBeenCalledTimes(4)
  })

  it("shows a position sought until YouTube reports it", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    await flush()
    yt.ready()
    yt.player.time = 40
    yt.state(YOUTUBE_STATE.PAUSED)

    driver.seek(12)
    expect(yt.calls).toEqual(["seek 12"])
    // YouTube still says 40 for a moment.
    expect(driver.position).toBe(12)

    yt.player.time = 12.1
    expect(driver.position).toBe(12.1)
  })

  it("stops showing a position sought that YouTube never reports", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    await flush()
    yt.ready()
    yt.player.time = 40
    yt.state(YOUTUBE_STATE.PLAYING)

    driver.seek(0)
    expect(driver.position).toBe(0)

    vi.advanceTimersByTime(2500)
    expect(driver.position).toBe(40)
  })

  it("cues a video that does not play at the position sought, never playing it", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    await flush()
    yt.ready()
    yt.state(YOUTUBE_STATE.CUED)

    driver.seek(30)
    yt.state(YOUTUBE_STATE.CUED)

    expect(yt.calls).toEqual(["cue 30"])
    expect(driver).toMatchObject({ paused: true, position: 30 })

    // Over: back to the start, cued too.
    yt.state(YOUTUBE_STATE.ENDED)
    driver.seek(12)
    expect(yt.calls).toEqual(["cue 30", "cue 12"])
  })

  it("applies a position asked for before the player was ready", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    // A reload of the projected screen: where the host was.
    driver.seek(47)
    expect(driver.position).toBe(47)

    const played = driver.play()

    await flush()
    yt.ready()

    // Played from there at once: a cue then a play would lose the play.
    expect(yt.calls).toEqual(["load 47"])
    yt.state(YOUTUBE_STATE.PLAYING)
    await expect(played).resolves.toBeUndefined()
  })

  it("cues a position asked for before the player was ready, when not playing", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    driver.seek(47)
    await flush()
    yt.ready()

    expect(yt.calls).toEqual(["cue 47"])
    expect(driver).toMatchObject({ paused: true, position: 47 })
  })

  it("picks the video up where it was when its page reloads, playing if it was", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    await flush()
    yt.ready()
    const played = driver.play()

    yt.state(YOUTUBE_STATE.PLAYING)
    await played
    yt.player.time = 33.5
    vi.advanceTimersByTime(POLL_INTERVAL)
    yt.calls.length = 0

    // Moved by a plain append: the page reloads, cued at the link's start.
    yt.player.time = 0
    yt.ready()

    expect(yt.calls).toEqual(["load 33.5"])
    expect(driver.position).toBe(33.5)
  })

  it("picks a paused video up paused when its page reloads", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    await flush()
    yt.ready()
    yt.state(YOUTUBE_STATE.PLAYING)
    yt.player.time = 20
    yt.state(YOUTUBE_STATE.PAUSED)
    yt.calls.length = 0

    yt.ready()

    expect(yt.calls).toEqual(["cue 20"])
    expect(driver).toMatchObject({ paused: true, position: 20 })
  })

  it("takes the state YouTube gives when asked once its page reloaded, which sends none", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    await flush()
    yt.ready()
    void driver.play()
    yt.player.state = YOUTUBE_STATE.PLAYING
    yt.state(YOUTUBE_STATE.PLAYING)
    yt.player.time = 20
    vi.advanceTimersByTime(POLL_INTERVAL)

    // Moved by a plain append: ready again, and no state from now on.
    yt.player.time = 0
    yt.player.state = YOUTUBE_STATE.UNSTARTED
    yt.ready()
    expect(yt.calls.at(-1)).toBe("load 20")

    yt.player.state = YOUTUBE_STATE.PLAYING
    yt.player.time = 21
    vi.advanceTimersByTime(POLL_INTERVAL)
    expect(driver).toMatchObject({ paused: false, position: 21 })

    // K: paused, and seen paused.
    driver.pause()
    yt.player.state = YOUTUBE_STATE.PAUSED
    yt.player.time = 22.5
    vi.advanceTimersByTime(POLL_INTERVAL)
    expect(driver).toMatchObject({ paused: true, position: 22.5 })

    // The next screen: back where it was, paused, never from the start.
    yt.player.time = 0
    yt.player.state = YOUTUBE_STATE.UNSTARTED
    yt.ready()
    expect(yt.calls.at(-1)).toBe("cue 22.5")
    expect(driver.position).toBe(22.5)

    // Its end, too.
    yt.player.state = YOUTUBE_STATE.ENDED
    yt.player.time = 140
    vi.advanceTimersByTime(POLL_INTERVAL)
    expect(driver).toMatchObject({ ended: true, paused: true })
  })

  it("never takes the state it gives when asked while YouTube sends them", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    await flush()
    yt.ready()
    yt.state(YOUTUBE_STATE.PLAYING)
    // A reading behind the event.
    yt.player.state = YOUTUBE_STATE.PAUSED
    vi.advanceTimersByTime(POLL_INTERVAL)

    expect(driver.paused).toBe(false)
  })

  it("says YouTube does not answer when its player's page never comes", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()
    const played = driver.play()

    await flush()
    vi.advanceTimersByTime(READY_TIMEOUT - 1)
    expect(driver.failed).toBe(false)

    vi.advanceTimersByTime(1)
    expect(driver).toMatchObject({ failed: true, failure: "unreachable" })
    await expect(played).rejects.toThrow()
    expect(yt.onChange).toHaveBeenCalled()

    // It came at last: nothing failed.
    yt.ready()
    expect(driver).toMatchObject({ failed: false, failure: null })
  })

  it("waits for its page only once in the page, and no longer once ready", async () => {
    const yt = fakeYoutube()
    const box = yt.box as { isConnected: boolean }

    box.isConnected = false

    const driver = yt.create()

    await flush()
    vi.advanceTimersByTime(READY_TIMEOUT)
    expect(driver.failed).toBe(false)

    box.isConnected = true
    yt.ready()
    vi.advanceTimersByTime(READY_TIMEOUT * 2)
    expect(driver.failed).toBe(false)
  })

  it("says why YouTube refuses the video", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    await flush()
    yt.ready()

    const played = driver.play()

    yt.error(150)

    await expect(played).rejects.toThrow()
    expect(driver).toMatchObject({ failed: true, failure: "notEmbeddable" })
    await expect(driver.play()).rejects.toThrow()
  })

  it("tells a video YouTube does not have from one kept to YouTube, as its page says", async () => {
    const asked: string[] = []
    const status = { value: 404 as number | null }
    const yt = fakeYoutube({
      pageStatus: (watchUrl) => {
        asked.push(watchUrl)

        return Promise.resolve(status.value)
      },
    })
    const driver = yt.create()

    await flush()
    yt.ready()
    yt.error(150)

    expect(driver).toMatchObject({ failed: true, failure: "notEmbeddable" })

    await flush()

    expect(asked).toEqual(["https://www.youtube.com/watch?v=wIJE-WNenXA"])
    expect(driver).toMatchObject({ failed: true, failure: "notFound" })

    // Kept to YouTube (401, 403): its page says so.
    status.value = 401
    const kept = yt.create()

    await flush()
    yt.ready()
    yt.error(101)
    await flush()

    expect(kept.failure).toBe("embedDisabled")

    // No answer: the player's word stays.
    status.value = null
    const silent = yt.create()

    await flush()
    yt.ready()
    yt.error(150)
    await flush()

    expect(silent.failure).toBe("notEmbeddable")
  })

  it("asks YouTube's page only of a video it will not embed, and never once dropped", async () => {
    const pageStatus = vi.fn(() => Promise.resolve(404))
    const yt = fakeYoutube({ pageStatus })
    const driver = yt.create()

    await flush()
    yt.ready()
    yt.error(100)
    await flush()

    expect(pageStatus).not.toHaveBeenCalled()
    expect(driver.failure).toBe("notFound")

    const dropped = yt.create()

    await flush()
    yt.ready()
    yt.error(150)
    dropped.destroy()
    await flush()

    expect(pageStatus).toHaveBeenCalledTimes(1)
    expect(dropped.failure).toBe("notEmbeddable")
  })

  it("says when YouTube does not answer", async () => {
    const yt = fakeYoutube({ fails: true })
    const driver = yt.create()

    await flush()

    expect(driver).toMatchObject({ failed: true, failure: "unreachable" })
    expect(yt.onChange).toHaveBeenCalled()
  })

  it("loads nothing for a link that names no video", () => {
    const yt = fakeYoutube()
    const driver = yt.create({
      kind: "youtube",
      url: "https://www.youtube.com/@msa_agricole",
    })

    expect(yt.loadApi).not.toHaveBeenCalled()
    expect(driver).toMatchObject({ failed: true, failure: "invalid" })
  })

  it("drops YouTube's player, its frame's watch and its box", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    await flush()
    yt.ready()
    driver.destroy()
    yt.onChange.mockClear()
    vi.advanceTimersByTime(POLL_INTERVAL * 4)
    yt.state(YOUTUBE_STATE.PLAYING)

    expect(yt.calls).toEqual(["destroy"])
    expect(yt.unwatch).toHaveBeenCalled()
    expect(yt.removeBox).toHaveBeenCalled()
    expect(yt.onChange).not.toHaveBeenCalled()
  })

  it("creates no player once dropped before YouTube answered", async () => {
    const yt = fakeYoutube()
    const driver = yt.create()

    driver.destroy()
    await flush()

    expect(yt.options()).toBeNull()
  })
})

describe("handFocusBack", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // The page's window and document, as far as it uses them.
  const fakePage = () => {
    const listeners = new Map<string, (_event?: unknown) => void>()
    const blur = vi.fn()
    const frame = { blur } as unknown as HTMLIFrameElement
    const doc = { activeElement: frame as unknown }

    vi.stubGlobal("window", {
      addEventListener: (name: string, listener: () => void) =>
        listeners.set(name, listener),
      removeEventListener: (name: string) => listeners.delete(name),
      setTimeout: (callback: () => void, delay: number) =>
        setTimeout(callback, delay),
    })
    vi.stubGlobal("document", doc)

    const fire = (name: string, event?: unknown) => listeners.get(name)?.(event)

    return { frame, blur, fire, listeners }
  }

  it("gives the focus back to the page after a click in the player", () => {
    vi.useFakeTimers()
    const { frame, blur, fire } = fakePage()

    handFocusBack(frame)
    fire("blur")
    vi.advanceTimersByTime(0)

    expect(blur).toHaveBeenCalled()
  })

  it("leaves the focus in the player after a Tab into it", () => {
    vi.useFakeTimers()
    const { frame, blur, fire } = fakePage()

    handFocusBack(frame)
    fire("keydown", { key: "Tab" })
    fire("blur")
    vi.advanceTimersByTime(0)

    expect(blur).not.toHaveBeenCalled()
  })

  it("takes a click in the player a moment after a Tab for a click", () => {
    vi.useFakeTimers()
    const { frame, blur, fire } = fakePage()

    handFocusBack(frame)
    // A Tab among the page's controls, then a click in the player: the
    // click reaches no listener of the page.
    fire("keydown", { key: "Tab" })
    vi.advanceTimersByTime(2000)
    fire("blur")
    vi.advanceTimersByTime(0)

    expect(blur).toHaveBeenCalled()
  })

  it("stops watching", () => {
    const { frame, listeners } = fakePage()
    const stop = handFocusBack(frame)

    stop()
    expect(listeners.size).toBe(0)
  })
})
