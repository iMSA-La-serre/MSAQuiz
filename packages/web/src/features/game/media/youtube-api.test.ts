import {
  READY_TIMEOUT,
  watchReady,
  YOUTUBE_API_URL,
  YOUTUBE_FAILURES,
  youtubeFailureOf,
  youtubeFailureOfPage,
  youtubePlayerVars,
} from "@razzia/web/features/game/media/youtube-api"
import { afterEach, describe, expect, it, vi } from "vitest"

describe("loadYoutubeApi", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // Loaded once per page: a fresh module per test.
  const freshLoader = async () => {
    vi.resetModules()

    const { loadYoutubeApi } =
      await import("@razzia/web/features/game/media/youtube-api")

    return loadYoutubeApi
  }

  // A page, as far as the loading uses it: the scripts it appends, and the
  // one YouTube's first script adds (www-widgetapi-script).
  const fakePage = () => {
    const scripts: Array<{ src: string; removed: boolean }> = []
    const widget = {
      removed: false,
      remove: () => {
        widget.removed = true
      },
    }
    const page = {
      YT: undefined as unknown,
      onYouTubeIframeAPIReady: undefined as (() => void) | undefined,
      setTimeout: (callback: () => void, delay: number) =>
        setTimeout(callback, delay),
      clearTimeout: (timer: ReturnType<typeof setTimeout>) => {
        clearTimeout(timer)
      },
    }

    vi.stubGlobal("window", page)
    vi.stubGlobal("document", {
      createElement: () => {
        const script = {
          src: "",
          async: false,
          onerror: null,
          removed: false,
          remove: () => {
            script.removed = true
          },
        }

        scripts.push(script)

        return script
      },
      head: { append: () => undefined },
      getElementById: (id: string) =>
        id === "www-widgetapi-script" && !widget.removed ? widget : null,
    })

    return { page, scripts, widget }
  }

  it("loads YouTube's script, and gives its API once ready", async () => {
    vi.useFakeTimers()
    const { page, scripts } = fakePage()
    const loadYoutubeApi = await freshLoader()
    const loaded = loadYoutubeApi()
    const api = { Player: vi.fn() }

    expect(scripts.map(({ src }) => src)).toEqual([YOUTUBE_API_URL])
    page.YT = api
    page.onYouTubeIframeAPIReady?.()

    await expect(loaded).resolves.toBe(api)
    // Loaded once for the page.
    await expect(loadYoutubeApi()).resolves.toBe(api)
    expect(scripts).toHaveLength(1)
  })

  it("starts again from scratch after YouTube's second script never came", async () => {
    vi.useFakeTimers()
    const { page, scripts, widget } = fakePage()
    const loadYoutubeApi = await freshLoader()
    const first = loadYoutubeApi()

    // Its first script ran, marking the API as loading; its second did not.
    page.YT = { loading: 1, loaded: 0 }
    vi.advanceTimersByTime(20_000)

    await expect(first).rejects.toThrow()
    expect(page.YT).toBeUndefined()
    expect(widget.removed).toBe(true)
    expect(scripts[0].removed).toBe(true)

    // « Réessayer », the network back.
    const second = loadYoutubeApi()
    const api = { Player: vi.fn() }

    expect(scripts).toHaveLength(2)
    page.YT = api
    page.onYouTubeIframeAPIReady?.()
    await expect(second).resolves.toBe(api)
  })
})

describe("watchReady", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("says so when the player is still not ready, counted while in the page", () => {
    vi.useFakeTimers()
    let inPage = false
    const timeout = vi.fn()

    watchReady(() => inPage, timeout)
    vi.advanceTimersByTime(READY_TIMEOUT)
    expect(timeout).not.toHaveBeenCalled()

    inPage = true
    vi.advanceTimersByTime(READY_TIMEOUT)
    expect(timeout).toHaveBeenCalledTimes(1)
  })

  it("stops watching once ready", () => {
    vi.useFakeTimers()
    const timeout = vi.fn()
    const stop = watchReady(() => true, timeout)

    vi.advanceTimersByTime(READY_TIMEOUT - 1)
    stop()
    vi.advanceTimersByTime(READY_TIMEOUT)
    expect(timeout).not.toHaveBeenCalled()
  })
})

describe("youtubeFailureOf", () => {
  it("reads the codes of the player's errors", () => {
    expect(youtubeFailureOf(2)).toBe(YOUTUBE_FAILURES.INVALID)
    expect(youtubeFailureOf(100)).toBe(YOUTUBE_FAILURES.NOT_FOUND)
    expect(youtubeFailureOf(101)).toBe(YOUTUBE_FAILURES.NOT_EMBEDDABLE)
    expect(youtubeFailureOf(150)).toBe(YOUTUBE_FAILURES.NOT_EMBEDDABLE)
    expect(youtubeFailureOf(153)).toBe(YOUTUBE_FAILURES.REFUSED)
    expect(youtubeFailureOf(5)).toBe(YOUTUBE_FAILURES.PLAYER)
    expect(youtubeFailureOf(999)).toBe(YOUTUBE_FAILURES.PLAYER)
  })
})

describe("youtubeFailureOfPage", () => {
  it("tells a removed video from one kept to YouTube", () => {
    expect(youtubeFailureOfPage(404)).toBe(YOUTUBE_FAILURES.NOT_FOUND)
    expect(youtubeFailureOfPage(400)).toBe(YOUTUBE_FAILURES.NOT_FOUND)
    expect(youtubeFailureOfPage(401)).toBe(YOUTUBE_FAILURES.EMBED_DISABLED)
    expect(youtubeFailureOfPage(403)).toBe(YOUTUBE_FAILURES.EMBED_DISABLED)
  })

  it("keeps the player's word otherwise", () => {
    expect(youtubeFailureOfPage(200)).toBe(YOUTUBE_FAILURES.NOT_EMBEDDABLE)
    expect(youtubeFailureOfPage(null)).toBe(YOUTUBE_FAILURES.NOT_EMBEDDABLE)
  })
})

describe("youtubePlayerVars", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("plays inline, in French, from the start, with no other channel's video", () => {
    vi.stubGlobal("window", { location: { origin: "https://quiz.msa.fr" } })

    expect(youtubePlayerVars(12.8, { projected: false })).toEqual({
      playsinline: 1,
      rel: 0,
      hl: "fr",
      cc_lang_pref: "fr",
      iv_load_policy: 3,
      start: 12,
      origin: "https://quiz.msa.fr",
    })
  })

  it("shows a phone's player without YouTube's bar, its captions on", () => {
    vi.stubGlobal("window", { location: { origin: "https://quiz.msa.fr" } })

    expect(youtubePlayerVars(30, { projected: false, device: true })).toEqual({
      playsinline: 1,
      rel: 0,
      hl: "fr",
      cc_lang_pref: "fr",
      iv_load_policy: 3,
      start: 30,
      origin: "https://quiz.msa.fr",
      controls: 0,
      disablekb: 1,
      fs: 0,
      cc_load_policy: 1,
    })
  })

  it("leaves the projected screen's keys and full screen to the game", () => {
    vi.stubGlobal("window", { location: { origin: "https://quiz.msa.fr" } })

    expect(youtubePlayerVars(0, { projected: true })).toMatchObject({
      disablekb: 1,
      fs: 0,
      start: 0,
    })
  })
})
