import { STATUS, type StatusDataMap } from "@razzia/common/types/game/status"
import {
  hostMediaKey,
  hostMediaPlan,
} from "@razzia/web/features/game/media/plan"
import type { Status } from "@razzia/web/features/game/utils/createStatus"
import { describe, expect, it } from "vitest"

const VIDEO = { type: "video", url: "https://intranet.example/v.mp4" } as const

const status = (name: string, data: Record<string, unknown>) =>
  ({ name, data }) as unknown as Status<StatusDataMap>

describe("hostMediaPlan", () => {
  it("loads the video while the question is read, and starts it with the answers", () => {
    const reading = hostMediaPlan(
      status(STATUS.SHOW_QUESTION, {
        question: "Que montre la vidéo ?",
        media: VIDEO,
        questionType: "single",
      }),
    )

    expect(reading).toEqual({
      source: { kind: "video", url: VIDEO.url },
      autoplay: false,
      label: "Que montre la vidéo ?",
    })
    expect(
      hostMediaPlan(
        status(STATUS.SELECT_ANSWER, { media: VIDEO, questionType: "single" }),
      )?.autoplay,
    ).toBe(true)
  })

  it("starts a slide's video as soon as it shows", () => {
    expect(
      hostMediaPlan(
        status(STATUS.SHOW_QUESTION, { media: VIDEO, questionType: "slide" }),
      )?.autoplay,
    ).toBe(true)
  })

  it("keeps it on the distribution, without starting it", () => {
    expect(
      hostMediaPlan(
        status(STATUS.SHOW_RESPONSES, { question: "Q", media: VIDEO }),
      ),
    ).toEqual({
      source: { kind: "video", url: VIDEO.url },
      autoplay: false,
      label: "Q",
    })
  })

  it("plays a sound as a video", () => {
    expect(
      hostMediaPlan(
        status(STATUS.SELECT_ANSWER, {
          media: { type: "audio", url: "/media/son.mp3" },
        }),
      )?.source,
    ).toEqual({ kind: "audio", url: "/media/son.mp3" })
  })

  it("has nothing to play for an image, a type alone, or another screen", () => {
    expect(
      hostMediaPlan(
        status(STATUS.SELECT_ANSWER, {
          media: { type: "image", url: "https://intranet.example/a.png" },
        }),
      ),
    ).toBeNull()
    expect(
      hostMediaPlan(status(STATUS.SELECT_ANSWER, { media: { type: "video" } })),
    ).toBeNull()
    expect(hostMediaPlan(status(STATUS.SELECT_ANSWER, {}))).toBeNull()
    expect(
      hostMediaPlan(status(STATUS.SHOW_LEADERBOARD, { leaderboard: [] })),
    ).toBeNull()
    expect(hostMediaPlan(null)).toBeNull()
  })
})

describe("hostMediaKey", () => {
  it("tells the questions and the games apart", () => {
    const url = "https://intranet.example/v.mp4"

    expect(hostMediaKey("game", 2, url)).toBe(hostMediaKey("game", 2, url))
    expect(hostMediaKey("game", 2, url)).not.toBe(hostMediaKey("game", 3, url))
    expect(hostMediaKey("game", 2, url)).not.toBe(hostMediaKey("other", 2, url))
    expect(hostMediaKey(null, undefined, url)).toBe(`/0/${url}`)
  })
})
