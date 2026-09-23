import {
  isYoutubeAddress,
  youtubeStartOf,
  youtubeVideoOf,
  youtubeWatchUrl,
} from "@razzia/common/utils/youtube"
import { describe, expect, it } from "vitest"

const ID = "wIJE-WNenXA"

describe("youtubeVideoOf", () => {
  it("reads the video of every kind of YouTube link", () => {
    for (const url of [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com/watch?v=${ID}`,
      `http://www.youtube.com/watch?v=${ID}`,
      `https://m.youtube.com/watch?v=${ID}&feature=share`,
      `https://music.youtube.com/watch?v=${ID}`,
      `https://www.youtube.com/watch?feature=shared&v=${ID}`,
      `https://www.youtube.com/watch?v=${ID}&list=PLabc&index=3`,
      `https://youtu.be/${ID}`,
      `https://youtu.be/${ID}?si=Xy12_ab`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://youtube.com/shorts/${ID}?si=abc`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube.com/embed/${ID}?rel=0`,
      `https://www.youtube.com/live/${ID}?feature=share`,
      `https://www.youtube.com/v/${ID}`,
      `https://www.youtube-nocookie.com/embed/${ID}`,
      `https://youtube-nocookie.com/embed/${ID}/`,
      `  https://WWW.YouTube.com/watch?v=${ID}  `,
    ]) {
      expect(youtubeVideoOf(url), url).toEqual({ id: ID, start: 0 })
    }
  })

  it("reads where the link says the video starts", () => {
    expect(youtubeVideoOf(`https://youtu.be/${ID}?t=90`)?.start).toBe(90)
    expect(
      youtubeVideoOf(`https://www.youtube.com/watch?v=${ID}&t=1m30s`)?.start,
    ).toBe(90)
    expect(
      youtubeVideoOf(`https://www.youtube.com/watch?v=${ID}&t=1h2m3s`)?.start,
    ).toBe(3723)
    expect(youtubeVideoOf(`https://youtu.be/${ID}?t=45s`)?.start).toBe(45)
    expect(
      youtubeVideoOf(`https://www.youtube.com/embed/${ID}?start=12`)?.start,
    ).toBe(12)
    expect(
      youtubeVideoOf(`https://www.youtube.com/watch?v=${ID}#t=75`)?.start,
    ).toBe(75)
    // Unreadable: from the start.
    expect(youtubeVideoOf(`https://youtu.be/${ID}?t=abc`)?.start).toBe(0)
    expect(youtubeVideoOf(`https://youtu.be/${ID}?t=-5`)?.start).toBe(0)
  })

  it("names no video for a channel, a playlist or a search", () => {
    for (const url of [
      "https://www.youtube.com/",
      "https://www.youtube.com/@msa_agricole",
      "https://www.youtube.com/channel/UCLlovMAT34gqUK7PQ4p1LKA",
      "https://www.youtube.com/playlist?list=PLabcdefghijk",
      "https://www.youtube.com/embed/videoseries?list=PLabc",
      // A channel's live stream: eleven characters, but no video.
      "https://www.youtube.com/embed/live_stream?channel=UCLlovMAT34gqUK7PQ4p1LKA",
      "https://www.youtube-nocookie.com/embed/live_stream?channel=UCLlovMAT34gqUK7PQ4p1LKA",
      "https://www.youtube.com/results?search_query=msa",
      "https://www.youtube.com/watch?list=PLabc",
      "https://www.youtube.com/watch",
    ]) {
      expect(youtubeVideoOf(url), url).toBeUndefined()
    }
  })

  it("names no video for an identifier that is not one", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=abc",
      "https://www.youtube.com/watch?v=wIJE-WNenXA1",
      "https://youtu.be/wIJE WNenXA",
      "https://youtu.be/wIJE.WNenXA",
      `https://youtu.be/${ID}/extra`,
    ]) {
      expect(youtubeVideoOf(url), url).toBeUndefined()
    }
  })

  it("leaves every other site alone", () => {
    for (const url of [
      `https://notyoutube.com/watch?v=${ID}`,
      `https://youtube.com.evil.example/watch?v=${ID}`,
      `https://img.youtube.com/vi/${ID}/0.jpg`,
      `https://www.dailymotion.com/video/${ID}`,
      `youtube.com/watch?v=${ID}`,
      `ftp://youtube.com/watch?v=${ID}`,
      `/watch?v=${ID}`,
      "",
    ]) {
      expect(youtubeVideoOf(url), url).toBeUndefined()
    }
  })
})

describe("isYoutubeAddress", () => {
  it("tells an address of YouTube's, whatever it points to", () => {
    expect(isYoutubeAddress("https://www.youtube.com/@msa_agricole")).toBe(true)
    expect(isYoutubeAddress(`https://youtu.be/${ID}`)).toBe(true)
    expect(isYoutubeAddress("https://www.youtube-nocookie.com/")).toBe(true)
    expect(isYoutubeAddress("https://msa.example/youtube.com")).toBe(false)
    expect(isYoutubeAddress("https://img.youtube.com/vi/x/0.jpg")).toBe(false)
    expect(isYoutubeAddress("pas une adresse")).toBe(false)
  })
})

describe("youtubeStartOf", () => {
  it("reads seconds and YouTube's durations", () => {
    expect(youtubeStartOf("0")).toBe(0)
    expect(youtubeStartOf("125")).toBe(125)
    expect(youtubeStartOf("2m")).toBe(120)
    expect(youtubeStartOf("1H")).toBe(3600)
    expect(youtubeStartOf(" 3m05s ")).toBe(185)
    expect(youtubeStartOf(null)).toBe(0)
    expect(youtubeStartOf("")).toBe(0)
    expect(youtubeStartOf("1:30")).toBe(0)
  })
})

describe("youtubeWatchUrl", () => {
  it("gives the video's page, where it starts", () => {
    expect(youtubeWatchUrl({ id: ID, start: 0 })).toBe(
      `https://www.youtube.com/watch?v=${ID}`,
    )
    expect(youtubeWatchUrl({ id: ID, start: 90 })).toBe(
      `https://www.youtube.com/watch?v=${ID}&t=90s`,
    )
  })
})
