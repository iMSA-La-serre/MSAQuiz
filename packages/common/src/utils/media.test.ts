import { MEDIA_LIMITS } from "@razzia/common/constants"
import type { QuestionMedia } from "@razzia/common/types/game"
import {
  impliedMediaTypeOf,
  isSameServerPath,
  isTimedMedia,
  isVideoMedia,
  isVideoPageLink,
  MEDIA_ISSUES,
  mediaFileTypeOf,
  mediaIssue,
  mediaIssuesOf,
  mediaTypeOf,
  playedMedia,
  publicMedia,
  youtubeOfMedia,
} from "@razzia/common/utils/media"
import { describe, expect, it } from "vitest"

const DATA_IMAGE = "data:image/png;base64,iVBORw0KGgo="

describe("mediaTypeOf", () => {
  it("reads the type from the file's extension, whatever its case", () => {
    expect(mediaTypeOf("https://msa.example/plan.JPG")).toBe("image")
    expect(mediaTypeOf("https://msa.example/a/b.jpeg")).toBe("image")
    expect(mediaTypeOf("https://msa.example/logo.svg")).toBe("image")
    expect(mediaTypeOf("https://msa.example/anim.gif")).toBe("image")
    expect(mediaTypeOf("https://msa.example/photo.webp")).toBe("image")
    expect(mediaTypeOf("https://msa.example/film.mp4")).toBe("video")
    expect(mediaTypeOf("https://msa.example/film.webm")).toBe("video")
    expect(mediaTypeOf("https://msa.example/film.MOV")).toBe("video")
    expect(mediaTypeOf("https://msa.example/son.mp3")).toBe("audio")
    expect(mediaTypeOf("https://msa.example/son.wav")).toBe("audio")
    expect(mediaTypeOf("https://msa.example/son.ogg")).toBe("audio")
    expect(mediaTypeOf("https://msa.example/son.m4a")).toBe("audio")
  })

  it("ignores the query, the fragment and the spaces around", () => {
    expect(mediaTypeOf("  https://msa.example/film.mp4?v=2#t=10  ")).toBe(
      "video",
    )
    expect(mediaTypeOf("/media/film.mp4?download=1")).toBe("video")
  })

  it("reads a path on the quiz's own server", () => {
    expect(mediaTypeOf("/media/plan.png")).toBe("image")
  })

  it("takes an image pasted as a data: address for an image", () => {
    expect(mediaTypeOf(DATA_IMAGE)).toBe("image")
  })

  it("takes a YouTube video's link for a YouTube video", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      "https://youtu.be/aqz-KE-bpKQ?si=abc",
      "https://m.youtube.com/watch?v=aqz-KE-bpKQ&t=30",
      "https://youtube.com/shorts/aqz-KE-bpKQ",
      "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
    ]) {
      expect(mediaTypeOf(url), url).toBe("youtube")
    }
  })

  it("takes any other link of YouTube's for YouTube, for the save to say why", () => {
    expect(mediaTypeOf("https://www.youtube.com/@msa_agricole")).toBe("youtube")
    expect(mediaTypeOf("https://www.youtube.com/playlist?list=PL1")).toBe(
      "youtube",
    )
    // A thumbnail is an image, wherever it is.
    expect(mediaTypeOf("https://img.youtube.com/vi/aqz-KE-bpKQ/0.jpg")).toBe(
      "image",
    )
  })

  it("takes another video site's page for a video", () => {
    expect(mediaTypeOf("https://www.dailymotion.com/video/x8abc")).toBe("video")
    expect(mediaTypeOf("https://vimeo.com/123456")).toBe("video")
  })

  it("tells nothing of a shared drive's link, an image as well as a video", () => {
    for (const url of [
      "https://drive.google.com/uc?export=view&id=1AbCdEf",
      "https://drive.google.com/file/d/1AbCdEf/view",
      "https://msa.sharepoint.com/:i:/s/com/EAbc",
      "https://onedrive.live.com/download?cid=1&resid=2",
    ]) {
      expect(mediaTypeOf(url), url).toBeUndefined()
    }
  })

  it("tells nothing when the address does not", () => {
    expect(mediaTypeOf("https://msa.example/image?id=3")).toBeUndefined()
    expect(mediaTypeOf("https://msa.example/fichier.pdf")).toBeUndefined()
    expect(mediaTypeOf("https://msa.example/dossier.mp4/")).toBeUndefined()
    expect(mediaTypeOf("")).toBeUndefined()
    // Not a web address: nothing to read, the save refuses it anyway.
    expect(mediaTypeOf(String.raw`C:\Users\maman\Videos\jeu.mp4`)).toBe(
      undefined,
    )
  })
})

describe("impliedMediaTypeOf", () => {
  it("reads a file's type, or YouTube for a YouTube video's link", () => {
    expect(impliedMediaTypeOf("https://msa.example/plan.png")).toBe("image")
    expect(impliedMediaTypeOf(" https://youtu.be/aqz-KE-bpKQ ")).toBe("youtube")
    // Neither a channel nor another site's page tells a type for sure.
    expect(
      impliedMediaTypeOf("https://www.youtube.com/@msa_agricole"),
    ).toBeUndefined()
    expect(
      impliedMediaTypeOf("https://www.dailymotion.com/video/x8abc"),
    ).toBeUndefined()
  })
})

describe("mediaFileTypeOf", () => {
  it("reads the file's extension or a pasted image, never a site", () => {
    expect(mediaFileTypeOf(" https://msa.example/plan.png ")).toBe("image")
    expect(mediaFileTypeOf("/media/film.mp4")).toBe("video")
    expect(mediaFileTypeOf(DATA_IMAGE)).toBe("image")
    expect(
      mediaFileTypeOf("https://www.youtube.com/watch?v=aqz-KE-bpKQ"),
    ).toBeUndefined()
    expect(mediaFileTypeOf("https://msa.example/image?id=3")).toBeUndefined()
  })
})

describe("isSameServerPath", () => {
  it("accepts a path on the quiz's own server", () => {
    expect(isSameServerPath("/media/film.mp4")).toBe(true)
    expect(isSameServerPath("/branding/logo.png")).toBe(true)
  })

  it("refuses another server and a Windows path", () => {
    expect(isSameServerPath("//cdn.example/film.mp4")).toBe(false)
    expect(isSameServerPath(String.raw`/\cdn.example/film.mp4`)).toBe(false)
    expect(isSameServerPath(String.raw`/media\film.mp4`)).toBe(false)
    expect(isSameServerPath("media/film.mp4")).toBe(false)
  })

  it("refuses a control character, which a browser drops", () => {
    // Read as //evil.example/a.png once the tab or the line break is gone.
    expect(isSameServerPath("/\t/evil.example/a.png")).toBe(false)
    expect(isSameServerPath("/\n/evil.example/a.png")).toBe(false)
    expect(isSameServerPath("/media/film\u007f.mp4")).toBe(false)
  })
})

describe("isVideoPageLink", () => {
  it("recognises the pages of the usual video sites", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      "https://m.youtube.com/watch?v=aqz-KE-bpKQ",
      "https://youtube.com/shorts/aqz-KE-bpKQ",
      "https://youtu.be/aqz-KE-bpKQ",
      "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
      "https://www.dailymotion.com/video/x8abc",
      "https://dai.ly/x8abc",
      "https://vimeo.com/123456",
      "https://drive.google.com/file/d/1abc/view",
      "https://drive.google.com/open?id=1abc",
      "https://msa.sharepoint.com/:v:/s/equipe/EAbc",
      "https://msa.sharepoint.com/sites/com/_layouts/15/stream.aspx?id=1",
      "https://web.microsoftstream.com/video/123",
      "https://1drv.ms/v/s!abc",
    ]) {
      expect(isVideoPageLink(url), url).toBe(true)
    }
  })

  it("lets a shared drive's download link through", () => {
    for (const url of [
      "https://drive.google.com/uc?export=download&id=1AbCdEf",
      "https://drive.google.com/uc?export=view&id=1AbCdEf",
      "https://docs.google.com/uc?id=1AbCdEf&export=download",
      "https://msa.sharepoint.com/sites/com/_layouts/15/download.aspx?UniqueId=abc",
      "https://msa.sharepoint.com/:v:/s/equipe/EAbc?download=1",
      "https://onedrive.live.com/download?cid=1&resid=2",
    ]) {
      expect(isVideoPageLink(url), url).toBe(false)
    }
  })

  it("lets a file through, even on those sites", () => {
    expect(
      isVideoPageLink(
        "https://msa.sharepoint.com/sites/equipe/Documents/film.mp4",
      ),
    ).toBe(false)
  })

  it("leaves the other sites alone", () => {
    expect(isVideoPageLink("https://msa.example/watch?v=1")).toBe(false)
    expect(isVideoPageLink("https://notyoutube.com/watch?v=1")).toBe(false)
    expect(isVideoPageLink("/media/film")).toBe(false)
  })
})

describe("mediaIssue", () => {
  it("accepts a web address, a path of the quiz's server and a small pasted image", () => {
    expect(
      mediaIssue({ type: "video", url: "https://msa.example/film.mp4" }),
    ).toBeUndefined()
    expect(
      mediaIssue({ type: "audio", url: "http://intranet.msa/son.mp3" }),
    ).toBeUndefined()
    expect(
      mediaIssue({ type: "video", url: "/media/film.mp4" }),
    ).toBeUndefined()
    expect(mediaIssue({ type: "image", url: DATA_IMAGE })).toBeUndefined()
  })

  it("refuses what the screens and the phones cannot load", () => {
    for (const url of [
      String.raw`C:\Users\maman\Videos\jeu.mp4`,
      "file:///C:/Users/maman/Videos/jeu.mp4",
      "www.exemple.fr/photo.png",
      "localhost:3000/a.png",
      // oxlint-disable-next-line no-script-url -- refused as data, never run
      "javascript:alert(1)",
      "ftp://msa.example/film.mp4",
      "blob:https://msa.example/1234",
      "mailto:a@b.fr",
      "about:blank",
      "//cdn.example/film.mp4",
      "pas une url",
      "/\t/evil.example/a.mp4",
      "https://intra\nnet.msa.fr/film.mp4",
      String.raw`https:\\msa.example\film.mp4`,
    ]) {
      expect(mediaIssue({ type: "video", url }), url).toBe(MEDIA_ISSUES.NOT_WEB)
    }
  })

  it("only takes an image as a data: address", () => {
    expect(mediaIssue({ type: "video", url: DATA_IMAGE })).toBe(
      MEDIA_ISSUES.NOT_WEB,
    )
    expect(mediaIssue({ type: "image", url: "data:text/html,<b>x</b>" })).toBe(
      MEDIA_ISSUES.NOT_WEB,
    )
    expect(
      mediaIssue({ type: "video", url: "data:video/mp4;base64,AAAA" }),
    ).toBe(MEDIA_ISSUES.NOT_WEB)
  })

  it("refuses a pasted image past about 500 KB", () => {
    const heavy = `data:image/png;base64,${"A".repeat(MEDIA_LIMITS.DATA_URL_LENGTH)}`

    expect(mediaIssue({ type: "image", url: heavy })).toBe(
      MEDIA_ISSUES.DATA_TOO_LARGE,
    )
  })

  it("refuses a video page's link as a video or a sound", () => {
    const url = "https://www.dailymotion.com/video/x8abc"

    expect(mediaIssue({ type: "video", url })).toBe(MEDIA_ISSUES.PAGE_LINK)
    expect(mediaIssue({ type: "audio", url })).toBe(MEDIA_ISSUES.PAGE_LINK)
    expect(mediaIssue({ url })).toBe(MEDIA_ISSUES.PAGE_LINK)
    // A YouTube address that names no video, as a video file.
    expect(
      mediaIssue({ type: "video", url: "https://www.youtube.com/@msa" }),
    ).toBe(MEDIA_ISSUES.PAGE_LINK)
  })

  it("accepts a YouTube video's link as a YouTube video", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      "https://youtu.be/aqz-KE-bpKQ?t=90",
      " https://www.youtube.com/live/aqz-KE-bpKQ ",
    ]) {
      expect(mediaIssue({ type: "youtube", url }), url).toBeUndefined()
    }
  })

  it("asks for a video's link on YouTube", () => {
    for (const url of [
      "https://www.youtube.com/@msa_agricole",
      "https://www.youtube.com/playlist?list=PL1",
      "https://www.youtube.com/embed/videoseries?list=PL1",
      "https://www.dailymotion.com/video/x8abc",
      "https://msa.example/film.mp4",
      "/media/film.mp4",
    ]) {
      expect(mediaIssue({ type: "youtube", url }), url).toBe(
        MEDIA_ISSUES.YOUTUBE_LINK,
      )
    }
    // Neither a file of the computer nor a pasted image.
    expect(mediaIssue({ type: "youtube", url: String.raw`C:\film.mp4` })).toBe(
      MEDIA_ISSUES.NOT_WEB,
    )
    expect(mediaIssue({ type: "youtube", url: DATA_IMAGE })).toBe(
      MEDIA_ISSUES.NOT_WEB,
    )
  })

  it("asks for the YouTube type for a YouTube video's link as a file", () => {
    const url = "https://youtu.be/aqz-KE-bpKQ"

    expect(mediaIssue({ type: "video", url })).toBe(MEDIA_ISSUES.YOUTUBE_TYPE)
    expect(mediaIssue({ type: "audio", url })).toBe(MEDIA_ISSUES.YOUTUBE_TYPE)
    // Without a type, as any address: a save gives it YouTube's.
    expect(mediaIssue({ url })).toBe(MEDIA_ISSUES.TYPE_MISSING)
  })

  it("never takes a page of YouTube's for an image", () => {
    // A video's link: every phone would contact YouTube.
    for (const url of [
      "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      "https://youtu.be/aqz-KE-bpKQ",
      "https://m.youtube.com/watch?v=aqz-KE-bpKQ",
    ]) {
      expect(mediaIssue({ type: "image", url }), url).toBe(
        MEDIA_ISSUES.YOUTUBE_TYPE,
      )
    }

    // Any other page of YouTube's.
    expect(
      mediaIssue({ type: "image", url: "https://www.youtube.com/@msa" }),
    ).toBe(MEDIA_ISSUES.PAGE_LINK)
    // YouTube's pictures are images, and a shared drive's page may be one.
    expect(
      mediaIssue({
        type: "image",
        url: "https://img.youtube.com/vi/aqz-KE-bpKQ/hqdefault.jpg",
      }),
    ).toBeUndefined()
    expect(
      mediaIssue({
        type: "image",
        url: "https://drive.google.com/file/d/1AbCdEf/view",
      }),
    ).toBeUndefined()
  })

  it("asks for a type the address does not tell", () => {
    expect(mediaIssue({ url: "https://msa.example/image?id=3" })).toBe(
      MEDIA_ISSUES.TYPE_MISSING,
    )
    // A shared drive's image link: the author picks Image.
    const drive = "https://drive.google.com/uc?export=view&id=1AbCdEf"

    expect(mediaIssue({ url: drive })).toBe(MEDIA_ISSUES.TYPE_MISSING)
    expect(mediaIssue({ type: "image", url: drive })).toBeUndefined()
  })

  it("takes a shared drive's download link as a video or a sound", () => {
    expect(
      mediaIssue({
        type: "audio",
        url: "https://drive.google.com/uc?export=download&id=1AbCdEf",
      }),
    ).toBeUndefined()
    expect(
      mediaIssue({
        type: "video",
        url: "https://msa.sharepoint.com/sites/com/_layouts/15/download.aspx?UniqueId=abc",
      }),
    ).toBeUndefined()
    expect(
      mediaIssue({
        type: "video",
        url: "https://drive.google.com/file/d/1AbCdEf/view",
      }),
    ).toBe(MEDIA_ISSUES.PAGE_LINK)
  })

  it("reads the address without the spaces around it", () => {
    expect(
      mediaIssue({ type: "image", url: "  https://msa.example/a.png " }),
    ).toBeUndefined()
  })
})

describe("mediaIssuesOf", () => {
  it("names each question whose media a save would refuse", () => {
    expect(
      mediaIssuesOf([
        { media: { type: "image", url: "https://msa.example/a.png" } },
        {},
        { media: { type: "video", url: "https://youtu.be/aqz-KE-bpKQ" } },
        { media: { url: "https://msa.example/image?id=3" } },
        { media: { type: "youtube", url: "https://youtu.be/aqz-KE-bpKQ" } },
        { media: { type: "video", url: "https://vimeo.com/123456" } },
      ]),
    ).toEqual([
      { message: MEDIA_ISSUES.YOUTUBE_TYPE, questionIndex: 2 },
      { message: MEDIA_ISSUES.TYPE_MISSING, questionIndex: 3 },
      { message: MEDIA_ISSUES.PAGE_LINK, questionIndex: 5 },
    ])
  })
})

describe("isTimedMedia", () => {
  it("tells a video, a sound and a YouTube video from an image or no type", () => {
    expect(isTimedMedia("video")).toBe(true)
    expect(isTimedMedia("audio")).toBe(true)
    expect(isTimedMedia("youtube")).toBe(true)
    expect(isTimedMedia("image")).toBe(false)
    expect(isTimedMedia(undefined)).toBe(false)
  })
})

describe("isVideoMedia", () => {
  it("tells a video, a file or YouTube's, from the rest", () => {
    expect(isVideoMedia("video")).toBe(true)
    expect(isVideoMedia("youtube")).toBe(true)
    expect(isVideoMedia("audio")).toBe(false)
    expect(isVideoMedia("image")).toBe(false)
    expect(isVideoMedia(undefined)).toBe(false)
  })
})

describe("publicMedia", () => {
  it("gives a phone an image whole, without its playback setting", () => {
    expect(
      publicMedia({
        type: "image",
        url: "https://msa.example/plan.png",
        playback: "devices",
      }),
    ).toEqual({ type: "image", url: "https://msa.example/plan.png" })
  })

  it("gives a phone a video or a sound as its type only", () => {
    expect(
      publicMedia({ type: "video", url: "https://msa.example/film.mp4" }),
    ).toEqual({ type: "video" })
    expect(
      publicMedia({
        type: "audio",
        url: "/media/son.mp3",
        playback: "screen",
      }),
    ).toEqual({ type: "audio" })
  })

  it("gives a phone a YouTube video as its type only: no link, no video", () => {
    expect(
      publicMedia({
        type: "youtube",
        url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=90",
      }),
    ).toEqual({ type: "youtube" })
  })

  it("gives nothing of a media without a type, or of none", () => {
    expect(publicMedia({ url: "https://msa.example/fichier" })).toBeUndefined()
    expect(publicMedia(undefined)).toBeUndefined()
  })

  it("never gives a phone a page of YouTube's as an image", () => {
    // A stored quiz from before the rule: the video it is, as its type.
    expect(
      publicMedia({
        type: "image",
        url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      }),
    ).toEqual({ type: "youtube" })
    expect(
      publicMedia({ type: "video", url: "https://youtu.be/aqz-KE-bpKQ" }),
    ).toEqual({ type: "youtube" })
    expect(
      publicMedia({ type: "image", url: "https://www.youtube.com/@msa" }),
    ).toBeUndefined()
    // YouTube's pictures are images.
    expect(
      publicMedia({
        type: "image",
        url: "https://img.youtube.com/vi/aqz-KE-bpKQ/0.jpg",
      }),
    ).toEqual({
      type: "image",
      url: "https://img.youtube.com/vi/aqz-KE-bpKQ/0.jpg",
    })
  })
})

describe("youtubeOfMedia", () => {
  it("reads the video of a YouTube media, and of a video's link stored as a file or an image", () => {
    const url = "https://youtu.be/aqz-KE-bpKQ?t=90"
    const video = { id: "aqz-KE-bpKQ", start: 90 }

    expect(youtubeOfMedia({ type: "youtube", url })).toEqual(video)
    expect(youtubeOfMedia({ type: "video", url })).toEqual(video)
    expect(youtubeOfMedia({ type: "image", url })).toEqual(video)
    expect(youtubeOfMedia({ url })).toEqual(video)
  })

  it("reads no video of a sound, a file or a phone's copy", () => {
    expect(
      youtubeOfMedia({ type: "audio", url: "https://youtu.be/aqz-KE-bpKQ" }),
    ).toBeUndefined()
    expect(
      youtubeOfMedia({ type: "video", url: "https://msa.example/film.mp4" }),
    ).toBeUndefined()
    expect(youtubeOfMedia({ type: "youtube" })).toBeUndefined()
    expect(youtubeOfMedia(undefined)).toBeUndefined()
  })
})

describe("playedMedia", () => {
  it("plays a YouTube video's link stored as a file or an image as the YouTube video", () => {
    const url = "https://www.youtube.com/watch?v=aqz-KE-bpKQ"

    expect(playedMedia({ type: "video", url, playback: "screen" })).toEqual({
      type: "youtube",
      url,
      playback: "screen",
    })
    expect(playedMedia({ type: "image", url })).toEqual({
      type: "youtube",
      url,
    })
  })

  it("leaves anything else as it is", () => {
    const youtube: QuestionMedia = {
      type: "youtube",
      url: "https://youtu.be/aqz-KE-bpKQ",
    }
    const sound: QuestionMedia = {
      type: "audio",
      url: "https://youtu.be/aqz-KE-bpKQ",
    }
    const image: QuestionMedia = {
      type: "image",
      url: "https://msa.example/a.png",
    }

    expect(playedMedia(youtube)).toBe(youtube)
    expect(playedMedia(sound)).toBe(sound)
    expect(playedMedia(image)).toBe(image)
    expect(playedMedia(undefined)).toBeUndefined()
  })
})
