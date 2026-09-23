// What a YouTube link points to: the video, and where it starts.
export interface YoutubeVideo {
  // Eleven letters, digits, « - » or « _ ».
  id: string
  // Seconds from the start of the video, 0 when the link tells none.
  start: number
}

// Where YouTube's links live: its site, on a computer, a phone or its music
// site; its short links; its privacy-enhanced player.
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
])

// The paths that name the video after them: its player, a short, a live
// stream (or its recording), the old player.
const ID_PATH = /^\/(?:embed|shorts|live|v|e)\/([^/?#]+)\/?$/u

const VIDEO_ID = /^[\w-]{11}$/u

// Eleven characters too, but never a video: a playlist's player, a channel's
// live stream (embed/live_stream?channel=…).
const NOT_VIDEOS = new Set(["videoseries", "live_stream"])

// 90, 90s, 1m30s, 1h2m3s: YouTube's ways of writing where a video starts.
const SECONDS = /^\d+$/u
const DURATION = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/u

/** Where a link says the video starts, in whole seconds; 0 if unreadable. */
export const youtubeStartOf = (value: string | null | undefined): number => {
  const text = value?.trim().toLowerCase() ?? ""

  if (SECONDS.test(text)) {
    return Number(text)
  }

  const match = text === "" ? null : DURATION.exec(text)

  if (!match) {
    return 0
  }

  const [, hours = "0", minutes = "0", seconds = "0"] = match

  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)
}

const webAddressOf = (url: string): URL | undefined => {
  if (!/^https?:\/\//iu.test(url)) {
    return undefined
  }

  try {
    return new URL(url)
  } catch {
    return undefined
  }
}

/** Whether an address is on one of YouTube's sites, whatever it points to. */
export const isYoutubeAddress = (url: string): boolean => {
  const address = webAddressOf(url.trim())

  return (
    address !== undefined && YOUTUBE_HOSTS.has(address.hostname.toLowerCase())
  )
}

const idOf = (address: URL): string | undefined => {
  const host = address.hostname.toLowerCase()
  const path = address.pathname

  if (host === "youtu.be" || host === "www.youtu.be") {
    return /^\/([^/?#]+)\/?$/u.exec(path)?.[1]
  }

  if (path === "/watch" || path === "/watch/") {
    return address.searchParams.get("v") ?? undefined
  }

  return ID_PATH.exec(path)?.[1]
}

/**
 * The video a YouTube link points to, and where it starts (t= or start=, in
 * the query or after #): a page of the site (watch?v=, on a computer or a
 * phone), a short link (youtu.be), a short, a live stream, a player's
 * address (embed, youtube-nocookie). Undefined for any other address, and
 * for a link to a channel or a playlist alone, which name no video.
 */
export const youtubeVideoOf = (url: string): YoutubeVideo | undefined => {
  const address = webAddressOf(url.trim())

  if (!address || !YOUTUBE_HOSTS.has(address.hostname.toLowerCase())) {
    return undefined
  }

  const id = idOf(address)

  if (id === undefined || !VIDEO_ID.test(id) || NOT_VIDEOS.has(id)) {
    return undefined
  }

  const hash = new URLSearchParams(address.hash.replace(/^#/u, ""))
  const start =
    address.searchParams.get("t") ??
    address.searchParams.get("start") ??
    hash.get("t") ??
    hash.get("start")

  return { id, start: youtubeStartOf(start) }
}

/**
 * The video's page on YouTube, where it starts: where « Ouvrir sur YouTube »
 * leads, and what the result window and the exported report show.
 */
export const youtubeWatchUrl = ({ id, start }: YoutubeVideo): string =>
  `https://www.youtube.com/watch?v=${id}${start > 0 ? `&t=${start}s` : ""}`
