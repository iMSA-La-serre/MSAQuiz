import {
  MEDIA_EXTENSIONS,
  MEDIA_LIMITS,
  MEDIA_TYPES,
} from "@razzia/common/constants"
import type {
  QuestionMedia,
  QuestionMediaType,
  QuizzError,
} from "@razzia/common/types/game"

type MediaType = NonNullable<QuestionMediaType>

const TYPES = Object.values(MEDIA_TYPES)

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
    : TYPES.find((type) =>
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
 * does not tell. What a stored media without a type is read as.
 */
export const mediaFileTypeOf = (url: string): MediaType | undefined => {
  const address = url.trim()

  return DATA_IMAGE.test(address) ? MEDIA_TYPES.IMAGE : typeOfExtension(address)
}

/**
 * The type an address tells, as the editor picks it: the file's (see
 * mediaFileTypeOf), or a video for a video site's page (which the save then
 * refuses, with a message that says why). A shared drive's link tells
 * nothing: it may hold an image as well as a video.
 */
export const mediaTypeOf = (url: string): MediaType | undefined =>
  mediaFileTypeOf(url) ??
  (isVideoSitePage(url.trim()) ? MEDIA_TYPES.VIDEO : undefined)

/**
 * Why a media cannot be saved, as an error key, or undefined when it can.
 * The screens and the phones load the address themselves: it must be a web
 * address (http or https), a path on the quiz's own server, or a small image
 * pasted as a data: address. A video page's link is not a file, and a media
 * needs a type to be shown at all.
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

  if (type !== MEDIA_TYPES.IMAGE && isVideoPageLink(address)) {
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
