import { STATUS, type StatusDataMap } from "@razzia/common/types/game/status"
import {
  deviceMediaKey,
  devicePlan,
  hostMediaKey,
  hostMediaPlan,
} from "@razzia/web/features/game/media/plan"
import type { DevicePlan } from "@razzia/web/features/game/media/device-media"
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
      devices: false,
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
      devices: false,
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

  it("plays a YouTube video from where its link says", () => {
    const url = "https://www.youtube.com/watch?v=wIJE-WNenXA&t=1m30s"

    expect(
      hostMediaPlan(
        status(STATUS.SELECT_ANSWER, {
          question: "La MSA ?",
          media: { type: "youtube", url },
          questionType: "slide",
        }),
      ),
    ).toEqual({
      source: { kind: "youtube", url, start: 90 },
      autoplay: true,
      label: "La MSA ?",
      devices: false,
    })
    // A link that names no video: YouTube's player says so.
    expect(
      hostMediaPlan(
        status(STATUS.SHOW_QUESTION, {
          media: { type: "youtube", url: "https://www.youtube.com/@msa" },
          questionType: "single",
        }),
      )?.source,
    ).toEqual({
      kind: "youtube",
      url: "https://www.youtube.com/@msa",
      start: 0,
    })
  })

  it("plays a YouTube link stored as a video file as the YouTube video", () => {
    const url = "https://youtu.be/wIJE-WNenXA"

    expect(
      hostMediaPlan(
        status(STATUS.SELECT_ANSWER, { media: { type: "video", url } }),
      )?.source,
    ).toEqual({ kind: "youtube", url, start: 0 })
    // Never a sound's.
    expect(
      hostMediaPlan(
        status(STATUS.SELECT_ANSWER, { media: { type: "audio", url } }),
      )?.source,
    ).toEqual({ kind: "audio", url })
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
    expect(
      hostMediaPlan(
        status(STATUS.SELECT_ANSWER, { media: { type: "youtube" } }),
      ),
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

describe("hostMediaPlan, a video on every device", () => {
  it("says the host's video plays on every device too", () => {
    const media = { ...VIDEO, playback: "devices" }

    for (const name of [
      STATUS.SHOW_QUESTION,
      STATUS.SELECT_ANSWER,
      STATUS.SHOW_RESPONSES,
    ]) {
      expect(hostMediaPlan(status(name, { media }))?.devices).toBe(true)
    }

    // A sound plays on the screen only.
    expect(
      hostMediaPlan(
        status(STATUS.SELECT_ANSWER, {
          media: { type: "audio", url: "/son.mp3", playback: "devices" },
        }),
      )?.devices,
    ).toBe(false)
  })
})

describe("devicePlan", () => {
  const devices = { ...VIDEO, playback: "devices" }
  const youtube = {
    type: "youtube",
    url: "https://www.youtube.com/watch?v=wIJE-WNenXA&t=30s",
    playback: "devices",
  }
  // The question shown, what the phone showed, no word from the server yet.
  const context = (previous: DevicePlan | null = null, question = 2) => ({
    gameId: "game",
    question,
    previous,
    state: null,
    label: "Vidéo de la question",
  })
  // After a reload: the server's word about `question`.
  const reloaded = (question: number) => ({
    ...context(),
    state: {
      question,
      media: {
        type: "video" as const,
        url: VIDEO.url,
        playback: "devices" as const,
      },
      playing: true,
      position: 3,
      at: 0,
      seq: 4,
    },
  })

  it("shows a phone the video that plays on every device, from the reading time on", () => {
    const plan = devicePlan(
      status(STATUS.SHOW_QUESTION, { question: "Q", media: devices }),
      context(),
    )

    expect(plan).toEqual({
      key: deviceMediaKey("game", 2, VIDEO.url),
      question: 2,
      source: { kind: "video", url: VIDEO.url },
      label: "Q",
    })
    expect(
      devicePlan(
        status(STATUS.SELECT_ANSWER, { question: "Q", media: youtube }),
        context(plan),
      ),
    ).toMatchObject({
      question: 2,
      source: { kind: "youtube", url: youtube.url, start: 30 },
    })
  })

  it("keeps it on the waiting screen of a player who answered, and on the result, for the same question", () => {
    const plan = devicePlan(
      status(STATUS.SELECT_ANSWER, { question: "Q", media: devices }),
      context(),
    )
    const answered = status(STATUS.WAIT, { text: "game:waitingForAnswers" })
    const result = status(STATUS.SHOW_RESULT, { outcome: "correct" })

    expect(devicePlan(answered, context(plan))).toBe(plan)
    expect(devicePlan(result, context(plan))).toBe(plan)
    expect(devicePlan(answered, context(plan, 3))).toBeNull()
    expect(
      devicePlan(
        status(STATUS.WAIT, { text: "game:waitingForPlayers" }),
        context(plan),
      ),
    ).toBeNull()
    expect(
      devicePlan(status(STATUS.SHOW_LEADERBOARD, {}), context(plan)),
    ).toBeNull()
  })

  it("finds it in the server's word on those screens after a reload, for the same question only", () => {
    const answered = status(STATUS.WAIT, { text: "game:waitingForAnswers" })
    const result = status(STATUS.SHOW_RESULT, { outcome: "correct" })

    for (const screen of [answered, result]) {
      expect(devicePlan(screen, reloaded(2))).toEqual({
        key: deviceMediaKey("game", 2, VIDEO.url),
        question: 2,
        source: { kind: "video", url: VIDEO.url },
        label: "Vidéo de la question",
      })
      expect(devicePlan(screen, reloaded(1))).toBeNull()
      expect(devicePlan(screen, context())).toBeNull()
    }
  })

  it("shows nothing of a video on the screen only, nor of a sound", () => {
    expect(
      devicePlan(
        status(STATUS.SELECT_ANSWER, {
          question: "Q",
          media: { type: "video" },
        }),
        context(),
      ),
    ).toBeNull()
    expect(
      devicePlan(
        status(STATUS.SELECT_ANSWER, {
          question: "Q",
          media: { type: "audio", url: "/son.mp3", playback: "devices" },
        }),
        context(),
      ),
    ).toBeNull()
  })
})
