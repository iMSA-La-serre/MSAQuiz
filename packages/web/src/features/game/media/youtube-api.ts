// The part of YouTube's IFrame Player API the quiz uses, declared here (no
// package added): https://developers.google.com/youtube/iframe_api_reference

export const YOUTUBE_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const

export interface YoutubeCue {
  videoId: string
  startSeconds?: number
}

export interface YoutubePlayer {
  playVideo: () => void
  pauseVideo: () => void
  // From any state but paused, the player plays once there.
  seekTo: (_seconds: number, _allowSeekAhead: boolean) => void
  // Shows the video at `startSeconds`, paused, without loading it.
  cueVideoById: (_cue: YoutubeCue) => void
  // Plays the video from `startSeconds`.
  loadVideoById: (_cue: YoutubeCue) => void
  getCurrentTime: () => number
  // 0 until known.
  getDuration: () => number
  getPlayerState: () => number
  getIframe: () => HTMLIFrameElement
  destroy: () => void
}

export interface YoutubePlayerEvents {
  onReady?: () => void
  onStateChange?: (_event: { data: number }) => void
  onError?: (_event: { data: number }) => void
  // The browser's autoplay policy refused playVideo().
  onAutoplayBlocked?: () => void
}

export interface YoutubePlayerOptions {
  host: string
  videoId: string
  width: string
  height: string
  playerVars: Record<string, string | number>
  events: YoutubePlayerEvents
}

export interface YoutubeApi {
  // Replaces `element` with the player's <iframe>.
  Player: new (
    _element: HTMLElement,
    _options: YoutubePlayerOptions,
  ) => YoutubePlayer
}

declare global {
  interface Window {
    YT?: Partial<YoutubeApi>
    onYouTubeIframeAPIReady?: () => void
  }
}

// YouTube's script, loaded the first time a player is needed: never on a
// phone, never on a page without a YouTube video.
export const YOUTUBE_API_URL = "https://www.youtube.com/iframe_api"

// The privacy-enhanced player: no cookie until the video plays, no
// personalised advertising.
export const YOUTUBE_PLAYER_HOST = "https://www.youtube-nocookie.com"

// How long YouTube may take to answer before the player says it does not:
// its script, then its player once created.
const LOAD_TIMEOUT = 20_000

export const READY_TIMEOUT = 20_000

let loading: Promise<YoutubeApi> | null = null

/**
 * YouTube's player API, loaded once for the page. Refused when YouTube does
 * not answer (no Internet, a proxy that blocks it): the next call tries
 * again, from the start. YouTube's first script leaves `YT` behind, marked as
 * loading, even when its second one never came: it then does nothing when
 * loaded again, so `YT` is dropped with the failure.
 */
export const loadYoutubeApi = (): Promise<YoutubeApi> => {
  loading ??= new Promise<YoutubeApi>((resolve, reject) => {
    const ready = window.YT

    if (ready?.Player) {
      resolve(ready as YoutubeApi)

      return
    }

    const script = document.createElement("script")
    const previous = window.onYouTubeIframeAPIReady

    const fail = () => {
      window.clearTimeout(timer)
      script.remove()

      if (window.YT && !window.YT.Player) {
        // Declared by YouTube's script (var YT): it cannot be deleted.
        window.YT = undefined
        document.getElementById("www-widgetapi-script")?.remove()
      }

      loading = null
      reject(new Error("YouTube did not answer"))
    }

    const timer = window.setTimeout(fail, LOAD_TIMEOUT)

    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      window.clearTimeout(timer)

      const api = window.YT

      if (api?.Player) {
        resolve(api as YoutubeApi)
      } else {
        fail()
      }
    }

    script.src = YOUTUBE_API_URL
    script.async = true
    script.onerror = fail
    document.head.append(script)
  })

  return loading
}

/**
 * Calls `onTimeout` when YouTube's player, just created, is still not ready
 * READY_TIMEOUT later: its page never came (a proxy that lets YouTube's
 * script through but blocks youtube-nocookie.com), and YouTube says nothing
 * of it. Counted while the player is in the page (`inPage`), where alone its
 * page loads. Returns what stops watching: once ready, or dropped.
 */
export const watchReady = (
  inPage: () => boolean,
  onTimeout: () => void,
): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | undefined = undefined

  const check = () => {
    if (inPage()) {
      onTimeout()
    } else {
      timer = setTimeout(check, READY_TIMEOUT)
    }
  }

  timer = setTimeout(check, READY_TIMEOUT)

  return () => {
    clearTimeout(timer)
  }
}

/**
 * The player's settings: inline on an iPhone, no video of another channel
 * suggested at the end, the interface and the captions in French when the
 * video has them, no annotation. `projected`: the projected screen, whose
 * keys belong to the game (the presentation remote), where the video goes
 * full screen through the host's control, never the player's.
 */
export const youtubePlayerVars = (
  start: number,
  { projected }: { projected: boolean },
): Record<string, string | number> => ({
  playsinline: 1,
  rel: 0,
  hl: "fr",
  cc_lang_pref: "fr",
  iv_load_policy: 3,
  start: Math.max(0, Math.floor(start)),
  origin: window.location.origin,
  ...(projected ? { disablekb: 1, fs: 0 } : {}),
})

// Why a YouTube player cannot play, as its message's key under
// « game:media.youtube ».
export const YOUTUBE_FAILURES = {
  // YouTube's script did not load: no Internet, or a proxy that blocks it.
  UNREACHABLE: "unreachable",
  // 100: removed, or private.
  NOT_FOUND: "notFound",
  // 101 and 150: its owner allows no player but YouTube's own; YouTube says
  // so of a removed video too.
  NOT_EMBEDDABLE: "notEmbeddable",
  // Its owner allows no player but YouTube's own, as its page tells (the
  // editor asks, see youtubeFailureOfPage).
  EMBED_DISABLED: "embedDisabled",
  // 153: the page did not tell YouTube where the player is (Referer).
  REFUSED: "refused",
  // 2, or a link that names no video.
  INVALID: "invalid",
  // 5, or any other code.
  PLAYER: "player",
} as const

export type YoutubeFailure =
  (typeof YOUTUBE_FAILURES)[keyof typeof YOUTUBE_FAILURES]

// The codes of the player's onError.
const FAILURE_CODES = new Map<number, YoutubeFailure>([
  [2, YOUTUBE_FAILURES.INVALID],
  [100, YOUTUBE_FAILURES.NOT_FOUND],
  [101, YOUTUBE_FAILURES.NOT_EMBEDDABLE],
  [150, YOUTUBE_FAILURES.NOT_EMBEDDABLE],
  [153, YOUTUBE_FAILURES.REFUSED],
])

/** Why the player stopped, from the code of its onError. */
export const youtubeFailureOf = (code: number): YoutubeFailure =>
  FAILURE_CODES.get(code) ?? YOUTUBE_FAILURES.PLAYER

/**
 * What YouTube's page of the video tells of a 101 or 150 (oEmbed): removed or
 * private when it has none (404), not to be embedded when it refuses
 * (401, 403). Anything else, or no answer, leaves the player's word.
 */
export const youtubeFailureOfPage = (status: number | null): YoutubeFailure => {
  if (status === 404 || status === 400) {
    return YOUTUBE_FAILURES.NOT_FOUND
  }

  if (status === 401 || status === 403) {
    return YOUTUBE_FAILURES.EMBED_DISABLED
  }

  return YOUTUBE_FAILURES.NOT_EMBEDDABLE
}

/**
 * Asks YouTube's page of a video for its status (oEmbed, without cookies):
 * the HTTP status, null without an answer.
 */
export const youtubePageStatus = async (
  watchUrl: string,
  signal?: AbortSignal,
): Promise<number | null> => {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`,
      { credentials: "omit", signal },
    )

    return response.status
  } catch {
    return null
  }
}
