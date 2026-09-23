import { MEDIA_ISSUES } from "@razzia/common/utils/media"
import {
  keepsPick,
  mediaDraftOf,
  mediaForUrl,
  pickOf,
} from "@razzia/web/features/quizz/utils/media"
import { describe, expect, it } from "vitest"

describe("mediaForUrl", () => {
  it("removes the media when the field is cleared", () => {
    expect(
      mediaForUrl({ type: "image", url: "https://a.fr/x.png" }, ""),
    ).toBeUndefined()
    expect(mediaForUrl({ url: "h" }, "   ")).toBeUndefined()
  })

  it("picks the type the address tells", () => {
    expect(mediaForUrl(undefined, "https://a.fr/plan.png")).toEqual({
      type: "image",
      url: "https://a.fr/plan.png",
    })
    expect(
      mediaForUrl(
        { type: "image", url: "https://a.fr/plan.png" },
        "https://a.fr/film.mp4",
      ),
    ).toEqual({ type: "video", url: "https://a.fr/film.mp4" })
  })

  it("keeps where a video or a sound plays, never on an image", () => {
    const video = {
      type: "video",
      url: "https://a.fr/film.mp4",
      playback: "devices",
    } as const

    expect(mediaForUrl(video, "https://a.fr/autre.webm")).toEqual({
      type: "video",
      url: "https://a.fr/autre.webm",
      playback: "devices",
    })
    expect(mediaForUrl(video, "https://a.fr/plan.png")).toEqual({
      type: "image",
      url: "https://a.fr/plan.png",
    })
  })

  it("recognises a YouTube video's link as it is pasted", () => {
    expect(
      mediaForUrl(
        { type: "video", url: "https://a.fr/film.mp4", playback: "screen" },
        "https://youtu.be/aqz-KE-bpKQ?si=abc",
      ),
    ).toEqual({
      type: "youtube",
      url: "https://youtu.be/aqz-KE-bpKQ?si=abc",
      playback: "screen",
    })
    // Back to a file: its type again.
    expect(
      mediaForUrl(
        { type: "youtube", url: "https://youtu.be/aqz-KE-bpKQ" },
        "https://a.fr/film.mp4",
      ),
    ).toEqual({ type: "video", url: "https://a.fr/film.mp4" })
  })

  it("keeps the address as typed, spaces included", () => {
    expect(mediaForUrl(undefined, " https://a.fr/son.mp3")).toEqual({
      type: "audio",
      url: " https://a.fr/son.mp3",
    })
  })

  it("leaves the type out while the address tells none", () => {
    expect(mediaForUrl(undefined, "https://a.fr/image?id=3")).toEqual({
      url: "https://a.fr/image?id=3",
    })
    expect(mediaForUrl(undefined, "h")).toEqual({ url: "h" })
  })

  it("keeps a type picked for an address that tells none", () => {
    expect(
      mediaForUrl(
        { type: "image", url: "https://a.fr/image?id=3" },
        "https://a.fr/image?id=4",
      ),
    ).toEqual({ type: "image", url: "https://a.fr/image?id=4" })
    // The new address tells: it wins over a type nothing contradicted.
    expect(
      mediaForUrl(
        { type: "image", url: "https://a.fr/image?id=3" },
        "https://a.fr/film.mp4",
      ),
    ).toEqual({ type: "video", url: "https://a.fr/film.mp4" })
  })

  it("keeps a type picked against the address, as the sound of a video", () => {
    expect(
      mediaForUrl(
        { type: "audio", url: "https://a.fr/clip.mp4" },
        "https://a.fr/clip2.mp4",
      ),
    ).toEqual({ type: "audio", url: "https://a.fr/clip2.mp4" })
    // While the address is typed, it tells nothing for a moment.
    expect(
      mediaForUrl(
        { type: "audio", url: "https://a.fr/clip.mp4" },
        "https://a.fr/clip.mp",
      ),
    ).toEqual({ type: "audio", url: "https://a.fr/clip.mp" })
  })

  it("drops a type picked against the address once another type is told", () => {
    expect(
      mediaForUrl(
        { type: "audio", url: "https://a.fr/clip.mp4" },
        "https://a.fr/photo.png",
      ),
    ).toEqual({ type: "image", url: "https://a.fr/photo.png" })
    expect(
      mediaForUrl(
        { type: "image", url: "https://a.fr/film.mp4" },
        "https://a.fr/son.mp3",
      ),
    ).toEqual({ type: "audio", url: "https://a.fr/son.mp3" })
  })
})

describe("pickOf and keepsPick", () => {
  it("finds the type picked against the address", () => {
    expect(pickOf({ type: "audio", url: "https://a.fr/clip.mp4" })).toEqual({
      type: "audio",
      told: "video",
    })
    expect(pickOf({ type: "image", url: "https://a.fr/image?id=3" })).toEqual({
      type: "image",
      told: undefined,
    })
    expect(pickOf({ type: "video", url: "https://a.fr/clip.mp4" })).toBe(
      undefined,
    )
    expect(pickOf({ url: "https://a.fr/clip.mp4" })).toBeUndefined()
  })

  it("keeps a pick the whole time the address is typed again", () => {
    // Audio picked for a video file; the last letter erased, then typed.
    const pick = pickOf({ type: "audio", url: "https://a.fr/clip.mp4" })
    let media = mediaForUrl(
      { type: "audio", url: "https://a.fr/clip.mp4" },
      "https://a.fr/clip.mp",
      pick,
    )

    expect(keepsPick(pick, "https://a.fr/clip.mp")).toBe(true)
    media = mediaForUrl(media, "https://a.fr/clip.mp4", pick)
    expect(media).toEqual({ type: "audio", url: "https://a.fr/clip.mp4" })
    // Typed letter by letter or pasted, a picture ends as an image.
    expect(keepsPick(pick, "https://a.fr/photo.png")).toBe(false)
    expect(mediaForUrl(media, "https://a.fr/photo.png", pick)?.type).toBe(
      "image",
    )
  })
})

describe("mediaDraftOf", () => {
  it("shows a YouTube video's link as a YouTube video", () => {
    expect(
      mediaDraftOf({ url: " https://youtu.be/aqz-KE-bpKQ?t=90 " }),
    ).toEqual({
      type: "youtube",
      issue: undefined,
      url: "https://youtu.be/aqz-KE-bpKQ?t=90",
    })
  })

  it("shows the type the address tells when none was picked", () => {
    expect(mediaDraftOf({ url: " https://a.fr/plan.png " })).toEqual({
      type: "image",
      issue: undefined,
      url: "https://a.fr/plan.png",
    })
  })

  it("says why the save would refuse the media", () => {
    expect(mediaDraftOf({ url: String.raw`C:\Videos\jeu.mp4` }).issue).toBe(
      MEDIA_ISSUES.NOT_WEB,
    )
    expect(mediaDraftOf({ url: "https://vimeo.com/123456" })).toEqual({
      type: "video",
      issue: MEDIA_ISSUES.PAGE_LINK,
      url: "https://vimeo.com/123456",
    })
    expect(
      mediaDraftOf({ url: "https://www.youtube.com/@msa_agricole" }),
    ).toEqual({
      type: "youtube",
      issue: MEDIA_ISSUES.YOUTUBE_LINK,
      url: "https://www.youtube.com/@msa_agricole",
    })
    // A YouTube video's link picked as a video file.
    expect(
      mediaDraftOf({ type: "video", url: "https://youtu.be/aqz-KE-bpKQ" })
        .issue,
    ).toBe(MEDIA_ISSUES.YOUTUBE_TYPE)
    expect(mediaDraftOf({ url: "https://a.fr/image?id=3" }).issue).toBe(
      MEDIA_ISSUES.TYPE_MISSING,
    )
  })
})
