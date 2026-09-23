import {
  askYoutubePage,
  youtubeFailures,
} from "@razzia/web/hooks/useYoutubeFailure"
import { describe, expect, it, vi } from "vitest"

describe("youtubeFailures", () => {
  it("keeps what a video itself tells, and says so", () => {
    const listener = vi.fn()
    const stop = youtubeFailures.subscribe(listener)

    youtubeFailures.fail("aaaaaaaaaaa", "notEmbeddable")
    expect(youtubeFailures.get("aaaaaaaaaaa")).toBe("notEmbeddable")
    expect(listener).toHaveBeenCalledTimes(1)

    // The same again: nothing new.
    youtubeFailures.fail("aaaaaaaaaaa", "notEmbeddable")
    expect(listener).toHaveBeenCalledTimes(1)

    youtubeFailures.forget("aaaaaaaaaaa")
    expect(youtubeFailures.get("aaaaaaaaaaa")).toBeUndefined()
    expect(listener).toHaveBeenCalledTimes(2)
    stop()
  })

  it("never blames a video for the network, the site or a link", () => {
    for (const failure of ["unreachable", "refused", "invalid"] as const) {
      youtubeFailures.fail("bbbbbbbbbbb", failure)
    }

    expect(youtubeFailures.get("bbbbbbbbbbb")).toBeUndefined()
  })
})

describe("askYoutubePage", () => {
  it("points out a video removed, private or kept to YouTube, before its question opens", async () => {
    const pages = new Map<string, number | null>([
      ["ccccccccccc", 404],
      ["ddddddddddd", 401],
      ["eeeeeeeeeee", 200],
      ["fffffffffff", 429],
      ["ggggggggggg", null],
    ])
    const pageStatus = vi.fn((watchUrl: string) =>
      Promise.resolve(
        pages.get(new URL(watchUrl).searchParams.get("v") ?? "") ?? null,
      ),
    )

    await Promise.all(
      [...pages.keys()].map((id) => askYoutubePage(id, pageStatus)),
    )

    expect(pageStatus).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=ccccccccccc",
    )
    expect(youtubeFailures.get("ccccccccccc")).toBe("notFound")
    expect(youtubeFailures.get("ddddddddddd")).toBe("embedDisabled")
    // Plays, or no telling.
    expect(youtubeFailures.get("eeeeeeeeeee")).toBeUndefined()
    expect(youtubeFailures.get("fffffffffff")).toBeUndefined()
    expect(youtubeFailures.get("ggggggggggg")).toBeUndefined()
  })

  it("asks once per video, again after « Réessayer »", async () => {
    const pageStatus = vi.fn(() => Promise.resolve(404))

    await askYoutubePage("hhhhhhhhhhh", pageStatus)
    await askYoutubePage("hhhhhhhhhhh", pageStatus)
    expect(pageStatus).toHaveBeenCalledTimes(1)

    youtubeFailures.forget("hhhhhhhhhhh")
    await askYoutubePage("hhhhhhhhhhh", pageStatus)
    expect(pageStatus).toHaveBeenCalledTimes(2)
    expect(youtubeFailures.get("hhhhhhhhhhh")).toBe("notFound")
  })
})
