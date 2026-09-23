import {
  MEDIA_EXTENSIONS,
  MEDIA_LIMITS,
  MEDIA_PLAYBACK,
  MEDIA_TYPES,
} from "@razzia/common/constants"
import type {
  DevicesMedia,
  QuestionMedia,
  QuestionMediaType,
  QuizzError,
  StatusMedia,
  TimedMediaType,
} from "@razzia/common/types/game"
import {
  isYoutubeAddress,
  type YoutubeVideo,
  youtubeVideoOf,
  youtubeWatchUrl,
} from "@razzia/common/utils/youtube"

type MediaType = NonNullable<QuestionMediaType>

// The types a file's extension tells (a YouTube video is no file).
const FILE_TYPES = Object.keys(MEDIA_EXTENSIONS) as Array<
  keyof typeof MEDIA_EXTENSIONS
>

// Sites whose every link opens a page that plays the video, never the file
// itself: a video or audio player cannot read them.
const VIDEO_SITES = [
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "dailymotion.com",
  "dai.ly",
  "vimeo.com",
  "microsoftstream.com",
  "facebook.com",
  "fb.watch",
  "instagram.com",
  "tiktok.com",
]

// File-sharing sites: a sharing link opens a page that shows the file (an
// image, a video, a document), a download link gives the file itself.
const SHARING_SITES = [
  "drive.google.com",
  "docs.google.com",
  "sharepoint.com",
  "onedrive.live.com",
  "1drv.ms",
]

// The download links of those sites: Google Drive's uc?export=download (or
// export=view, the image itself), SharePoint's download.aspx and ?download=1,
// OneDrive's /download.
const DOWNLOAD_LINK =
  /\/download\b|[?&](?:export=(?:download|view)|download=1)(?:&|$)/iu

const WEB_ADDRESS = /^https?:\/\//iu

const DATA_ADDRESS = /^data:/iu

const DATA_IMAGE = /^data:image\/[\w.+-]+[;,]/iu

export const MEDIA_ISSUES = {
  NOT_WEB: "errors:quizz.mediaUrlNotWeb",
  DATA_TOO_LARGE: "errors:quizz.mediaDataTooLarge",
  PAGE_LINK: "errors:quizz.mediaPageLink",
  TYPE_MISSING: "errors:quizz.mediaTypeMissing",
  // Chosen as YouTube, a link that names no YouTube video.
  YOUTUBE_LINK: "errors:quizz.mediaYoutubeLink",
  // A YouTube video's link, chosen as a video or a sound file.
  YOUTUBE_TYPE: "errors:quizz.mediaYoutubeType",
} as const

// A tab, a line break or another control character: a browser drops them
// from an address before reading it, so `/\t/host/…` would reach another
// server.
const hasControlCharacter = (url: string) => {
  for (let index = 0; index < url.length; index += 1) {
    const code = url.charCodeAt(index)

    if (code < 0x20 || code === 0x7f) {
      return true
    }
  }

  return false
}

/**
 * A path on the quiz's own server, as `/media/film.mp4`: one slash first,
 * never two (`//host/…` is another server), no backslash (a Windows path is
 * not a web address) and no control character (a browser drops them, which
 * could turn the path into another server's address).
 */
export const isSameServerPath = (url: string): boolean =>
  /^\/(?![/\\])[^\\]*$/u.test(url) && !hasControlCharacter(url)

// An absolute http or https address with a host; undefined for anything else
// (a file of the computer, another scheme, a host without its scheme).
const webAddressOf = (url: string): URL | undefined => {
  if (
    !WEB_ADDRESS.test(url) ||
    url.includes("\\") ||
    hasControlCharacter(url)
  ) {
    return undefined
  }

  try {
    const parsed = new URL(url)

    return parsed.hostname ? parsed : undefined
  } catch {
    return undefined
  }
}

// The extension of the file an address points to, lowercase, whatever
// follows it (?query, #fragment).
const extensionOf = (url: string): string | undefined => {
  const path =
    webAddressOf(url)?.pathname ??
    (isSameServerPath(url) ? url.split(/[?#]/u)[0] : undefined)
  const match = path === undefined ? null : /\.([a-z\d]+)$/iu.exec(path)

  return match?.[1].toLowerCase()
}

const typeOfExtension = (url: string): MediaType | undefined => {
  const extension = extensionOf(url)

  return extension === undefined
    ? undefined
    : FILE_TYPES.find((type) =>
        (MEDIA_EXTENSIONS[type] as readonly string[]).includes(extension),
      )
}

const isOnHost = (hostname: string, host: string) =>
  hostname === host || hostname.endsWith(`.${host}`)

const isOnSite = (address: URL, sites: string[]) => {
  const hostname = address.hostname.toLowerCase()

  return sites.some((site) => isOnHost(hostname, site))
}

// A link of a video site, whatever its path, that is not a file.
const isVideoSitePage = (url: string): boolean => {
  const address = webAddressOf(url)

  return (
    address !== undefined &&
    typeOfExtension(url) === undefined &&
    isOnSite(address, VIDEO_SITES)
  )
}

/**
 * A link to a page that plays or shows the media (YouTube, Dailymotion, a
 * shared drive's sharing link…) rather than to the file. A path that ends
 * with a media file's extension is a file, even on those sites (a video
 * stored on SharePoint), and so is a shared drive's download link.
 */
export const isVideoPageLink = (url: string): boolean => {
  const address = webAddressOf(url.trim())

  if (!address || typeOfExtension(url.trim()) !== undefined) {
    return false
  }

  if (isOnSite(address, VIDEO_SITES)) {
    return true
  }

  return (
    isOnSite(address, SHARING_SITES) &&
    !DOWNLOAD_LINK.test(`${address.pathname}${address.search}`)
  )
}

/**
 * The type of the file an address points to: the one of its extension, an
 * image for an image pasted as a data: address. Undefined when the address
 * does not tell.
 */
export const mediaFileTypeOf = (url: string): MediaType | undefined => {
  const address = url.trim()

  return DATA_IMAGE.test(address) ? MEDIA_TYPES.IMAGE : typeOfExtension(address)
}

/**
 * The type an address alone tells for sure: its file's (mediaFileTypeOf), or
 * YouTube for a YouTube video's link. What a stored media without a type is
 * read as, and what a save fills in.
 */
export const impliedMediaTypeOf = (url: string): MediaType | undefined =>
  mediaFileTypeOf(url) ??
  (youtubeVideoOf(url) ? MEDIA_TYPES.YOUTUBE : undefined)

/**
 * The type an address tells, as the editor picks it: the one it implies (see
 * impliedMediaTypeOf); YouTube for any other link of YouTube's (a channel, a
 * playlist, which the save then refuses, saying to copy the video's link); a
 * video for another video site's page (refused too, with a message that says
 * why). A shared drive's link tells nothing: it may hold an image as well as
 * a video.
 */
export const mediaTypeOf = (url: string): MediaType | undefined => {
  const implied = impliedMediaTypeOf(url)

  if (implied !== undefined) {
    return implied
  }

  if (isYoutubeAddress(url) && typeOfExtension(url.trim()) === undefined) {
    return MEDIA_TYPES.YOUTUBE
  }

  return isVideoSitePage(url.trim()) ? MEDIA_TYPES.VIDEO : undefined
}

/**
 * Why a media cannot be saved, as an error key, or undefined when it can.
 * The screens and the phones load the address themselves: it must be a web
 * address (http or https), a path on the quiz's own server, or a small image
 * pasted as a data: address. A YouTube media must name a video, and a YouTube
 * video's link is a YouTube media, never a file nor an image; another video
 * page's link is no file either, and no page of YouTube's is an image. A
 * media needs a type to be shown at all.
 */
export const mediaIssue = ({
  type,
  url,
}: QuestionMedia): string | undefined => {
  const address = url.trim()

  if (DATA_ADDRESS.test(address)) {
    if (
      !DATA_IMAGE.test(address) ||
      (type !== undefined && type !== MEDIA_TYPES.IMAGE)
    ) {
      return MEDIA_ISSUES.NOT_WEB
    }

    if (address.length > MEDIA_LIMITS.DATA_URL_LENGTH) {
      return MEDIA_ISSUES.DATA_TOO_LARGE
    }
  } else if (!isSameServerPath(address) && !webAddressOf(address)) {
    return MEDIA_ISSUES.NOT_WEB
  }

  const youtube = youtubeVideoOf(address)

  if (type === MEDIA_TYPES.YOUTUBE) {
    return youtube ? undefined : MEDIA_ISSUES.YOUTUBE_LINK
  }

  // Without a type, a save gives it YouTube's (impliedMediaTypeOf).
  if (youtube) {
    return type === undefined
      ? MEDIA_ISSUES.TYPE_MISSING
      : MEDIA_ISSUES.YOUTUBE_TYPE
  }

  // A shared drive's page may show an image; a page of YouTube's never does.
  if (
    isVideoPageLink(address) &&
    (type !== MEDIA_TYPES.IMAGE || isYoutubeAddress(address))
  ) {
    return MEDIA_ISSUES.PAGE_LINK
  }

  if (type === undefined) {
    return MEDIA_ISSUES.TYPE_MISSING
  }

  return undefined
}

/**
 * The media of a quiz a save would refuse, each with its question (0-based):
 * what an imported file keeps, for the author to fix in the editor.
 */
export const mediaIssuesOf = (
  questions: ReadonlyArray<{ media?: QuestionMedia }>,
): QuizzError[] =>
  questions.flatMap(({ media }, questionIndex) => {
    const message = media && mediaIssue(media)

    return message ? [{ message, questionIndex }] : []
  })

/**
 * A video (a file or YouTube's) or a sound: a media that plays over time,
 * which the host drives.
 */
export const isTimedMedia = (type: QuestionMediaType): type is TimedMediaType =>
  type === MEDIA_TYPES.VIDEO ||
  type === MEDIA_TYPES.AUDIO ||
  type === MEDIA_TYPES.YOUTUBE

/** A video, a file or YouTube's: a media that plays over time and shows. */
export const isVideoMedia = (type: QuestionMediaType): boolean =>
  type === MEDIA_TYPES.VIDEO || type === MEDIA_TYPES.YOUTUBE

/**
 * The YouTube video a media plays: a YouTube media's; a YouTube video's link
 * stored as a video file or an image (an older editor, an import let it
 * through) plays as the YouTube video it is too. Never a sound's.
 */
export const youtubeOfMedia = (
  media: { type?: QuestionMediaType; url?: string } | undefined,
): YoutubeVideo | undefined =>
  media?.url === undefined || media.type === MEDIA_TYPES.AUDIO
    ? undefined
    : youtubeVideoOf(media.url)

/**
 * The media as the game plays it, on every screen and in the results: a
 * YouTube video's link stored as a video file or an image is the YouTube
 * video it is (see youtubeOfMedia). Anything else as it is stored.
 */
export const playedMedia = (
  media: QuestionMedia | undefined,
): QuestionMedia | undefined =>
  media && media.type !== MEDIA_TYPES.YOUTUBE && youtubeOfMedia(media)
    ? { ...media, type: MEDIA_TYPES.YOUTUBE }
    : media

/**
 * Whether a media plays on every device, driven by the host: a video, a file
 * or a YouTube video, set so (MEDIA_PLAYBACK.DEVICES). A sound, and any media
 * without the setting or with one the game does not know, plays on the
 * projected screen only.
 */
export const playsOnDevices = (media: QuestionMedia | undefined): boolean =>
  media?.playback === MEDIA_PLAYBACK.DEVICES &&
  isVideoMedia(playedMedia(media)?.type)

/**
 * Where a video starts, in seconds: where a YouTube video's link says, 0 for
 * a file.
 */
export const mediaStartOf = (media: QuestionMedia | undefined): number =>
  youtubeOfMedia(playedMedia(media))?.start ?? 0

// A video, as the phones get it when it plays on every device.
const devicesCopyOf = (media: QuestionMedia): DevicesMedia | undefined => {
  const video = youtubeOfMedia(media)

  if (video) {
    return {
      type: MEDIA_TYPES.YOUTUBE,
      url: youtubeWatchUrl(video),
      playback: MEDIA_PLAYBACK.DEVICES,
    }
  }

  return media.type === MEDIA_TYPES.VIDEO
    ? {
        type: MEDIA_TYPES.VIDEO,
        url: media.url.trim(),
        playback: MEDIA_PLAYBACK.DEVICES,
      }
    : undefined
}

/**
 * A video that plays on every device (playsOnDevices), as the phones get it
 * (DevicesMedia); undefined for any other media, and for a YouTube media
 * whose link names no video (a quiz stored before the rule), which plays
 * nowhere.
 */
export const devicesMediaOf = (
  media: QuestionMedia | undefined,
): DevicesMedia | undefined => {
  const played = playedMedia(media)

  return played && playsOnDevices(played) ? devicesCopyOf(played) : undefined
}

/**
 * What a phone gets of a question's media. An image whole, as every screen
 * shows it. A video that plays on every device (playsOnDevices): a file's
 * address, a YouTube video's page rebuilt from its identifier and where it
 * starts, never the link as pasted; the phone loads it only once its user
 * asks. Any other video (a YouTube video too) or a sound, its type only: it
 * plays on the projected screen, driven by the host, and the phone says so;
 * its address never reaches a phone, so no phone loads the file nor contacts
 * YouTube. Nothing for a media without a type, which no screen shows, nor
 * for an « image » that is a page of YouTube's.
 */
export const publicMedia = (
  media: QuestionMedia | undefined,
): StatusMedia | undefined => {
  const played = playedMedia(media)

  if (played?.type === MEDIA_TYPES.IMAGE) {
    return isYoutubeAddress(played.url)
      ? undefined
      : { type: played.type, url: played.url }
  }

  if (!isTimedMedia(played?.type)) {
    return undefined
  }

  // A YouTube media whose link names no video (a quiz stored before the
  // rule) plays nowhere: the phone points to the screen, as for any other.
  return devicesMediaOf(played) ?? { type: played.type }
}
