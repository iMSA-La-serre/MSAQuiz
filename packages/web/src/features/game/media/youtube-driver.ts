import { youtubeVideoOf, youtubeWatchUrl } from "@razzia/common/utils/youtube"
import type {
  CreateDriver,
  MediaDriver,
  MediaSource,
} from "@razzia/web/features/game/media/controller"
import {
  loadYoutubeApi,
  YOUTUBE_FAILURES,
  YOUTUBE_PLAYER_HOST,
  YOUTUBE_STATE,
  type YoutubeApi,
  type YoutubeFailure,
  youtubeFailureOf,
  youtubeFailureOfPage,
  youtubePageStatus,
  type YoutubePlayer,
  youtubePlayerVars,
  watchReady,
} from "@razzia/web/features/game/media/youtube-api"

// How often the position is read while the player exists: YouTube tells no
// progress, and the host's own bar may move it.
export const POLL_INTERVAL = 250

// How long a position asked for (a seek) is shown before the player reports
// it: its word comes back a moment later.
const SEEK_GRACE = 2000

// Close enough to a position asked for to take the player's word again.
const SEEK_TOLERANCE = 1

const notAllowed = () =>
  Object.assign(new Error("YouTube refused to play without a gesture"), {
    name: "NotAllowedError",
  })

const aborted = () =>
  Object.assign(new Error("Paused before it played"), { name: "AbortError" })

export interface YoutubeDriverDeps {
  loadApi: () => Promise<YoutubeApi>
  // The box the stage moves, and the node inside it the player replaces.
  createBox: () => { box: HTMLElement; mount: HTMLElement }
  playerVars: (_start: number) => Record<string, string | number>
  // Watches the player's frame once created (the focus it takes); returns
  // what stops watching.
  watchFrame?: (_frame: HTMLIFrameElement) => () => void
  // Asks YouTube's page of a video for its status (youtubePageStatus): the
  // player says the same of a removed video and of one kept to YouTube.
  pageStatus?: (
    _watchUrl: string,
    _signal?: AbortSignal,
  ) => Promise<number | null>
  now?: () => number
}

const STATES = new Set<number>(Object.values(YOUTUBE_STATE))

interface Waiter {
  resolve: () => void
  reject: (_error: Error) => void
}

/**
 * A YouTube video played by YouTube's own player (IFrame Player API), from
 * youtube-nocookie.com, with YouTube's bar in it and the host's controls
 * under it, never over it. Loaded only when a question has one, on the
 * projected screen. The box holding it is what the stage moves: in place
 * where the browser can (Element.moveBefore); elsewhere its page reloads,
 * and the player picks the video up where it was, playing if it was (see
 * onReady). A player whose page never comes says YouTube does not answer
 * (watchReady).
 */
export const youtubeDriver =
  (deps: YoutubeDriverDeps): CreateDriver =>
  (source: MediaSource, onChange: () => void): MediaDriver => {
    const now = deps.now ?? Date.now
    const video = youtubeVideoOf(source.url)
    const { box, mount } = deps.createBox()
    let player: YoutubePlayer | null = null
    let ready = false
    let state: number = YOUTUBE_STATE.UNSTARTED
    let failure: YoutubeFailure | null = video ? null : YOUTUBE_FAILURES.INVALID
    // Where a video that does not play yet stands (cued): the player reads
    // 0 then.
    let cued = video?.start ?? 0
    // Where it was last seen, to pick it up after a reload of its page.
    let last = cued
    // A position asked for, until the player reports it.
    let target: { seconds: number; at: number } | null = null
    // The host wants it playing: play() since the last pause.
    let wanted = false
    let waiters: Waiter[] = []
    let poll: ReturnType<typeof setInterval> | undefined = undefined
    let unwatch: (() => void) | undefined = undefined
    let stopWatchingReady: (() => void) | undefined = undefined
    // Its page reloaded (a browser that cannot move it in place): YouTube no
    // longer tells its states then, only gives them when asked.
    let reloaded = false
    // Failed because its page never came, not by YouTube's word.
    let timedOut = false
    let label = ""
    // Its sound cut by its user (a phone's player): kept across a reload of
    // its page.
    let muted = false
    let destroyed = false
    // Drops the question to YouTube's page of the video with the player.
    const pageCheck = new AbortController()

    const settle = (outcome: Error | null) => {
      const pending = waiters

      waiters = []
      pending.forEach(({ resolve, reject }) => {
        if (outcome) {
          reject(outcome)
        } else {
          resolve()
        }
      })
    }

    const fail = (reason: YoutubeFailure) => {
      failure = reason
      wanted = false
      settle(new Error(`YouTube: ${reason}`))
      onChange()
    }

    // YouTube's player says the same (101, 150) of a video removed, private or
    // that never was, and of one its owner keeps to YouTube: its page tells
    // which, as in the editor. A video YouTube does not have then reads
    // « introuvable », and nothing sends the room to its page.
    const askPage = () => {
      if (!deps.pageStatus || !video) {
        return
      }

      void deps
        .pageStatus(
          youtubeWatchUrl({ id: video.id, start: 0 }),
          pageCheck.signal,
        )
        .then((status) => {
          const told = youtubeFailureOfPage(status)

          if (
            !destroyed &&
            failure === YOUTUBE_FAILURES.NOT_EMBEDDABLE &&
            told !== failure
          ) {
            failure = told
            onChange()
          }
        })
    }

    const readPosition = (): number => {
      if (
        !player ||
        !ready ||
        state === YOUTUBE_STATE.UNSTARTED ||
        state === YOUTUBE_STATE.CUED
      ) {
        return cued
      }

      const reported = player.getCurrentTime()

      if (target) {
        const reached = Math.abs(reported - target.seconds) < SEEK_TOLERANCE

        if (!reached && now() - target.at < SEEK_GRACE) {
          return target.seconds
        }

        target = null
      }

      return reported
    }

    // Its <iframe>, named by the question: YouTube names it « YouTube video
    // player ».
    const labelFrame = () => {
      if (player && ready && label !== "") {
        player.getIframe().title = label
      }
    }

    // Cuts the sound, or gives it back; a player just ready has it.
    const applyMuted = (always: boolean) => {
      if (!player || !ready || (!muted && !always)) {
        return
      }

      if (muted) {
        player.mute()
      } else {
        player.unMute()
      }
    }

    // Shows the video at `seconds`, paused, or plays it from there.
    const standAt = (seconds: number, play: boolean) => {
      if (!player || !video) {
        return
      }

      if (play) {
        player.loadVideoById({ videoId: video.id, startSeconds: seconds })
      } else {
        player.cueVideoById({ videoId: video.id, startSeconds: seconds })
      }

      cued = seconds
      last = seconds
    }

    const handleState = ({ data }: { data: number }) => {
      if (destroyed) {
        return
      }

      state = data

      if (data === YOUTUBE_STATE.PLAYING) {
        // By the host's controls, or YouTube's own bar.
        wanted = true
        settle(null)
      } else if (
        data === YOUTUBE_STATE.PAUSED ||
        data === YOUTUBE_STATE.ENDED
      ) {
        wanted = false
        settle(aborted())
      }

      if (data !== YOUTUBE_STATE.UNSTARTED && data !== YOUTUBE_STATE.CUED) {
        last = readPosition()
      }

      onChange()
    }

    // Once its page reloaded, YouTube sends no state: the one it gives when
    // asked is taken as if it had sent it.
    const readState = () => {
      if (!player || !reloaded) {
        return
      }

      const reported = player.getPlayerState()

      if (reported !== state && STATES.has(reported)) {
        handleState({ data: reported })
      }
    }

    const handleReady = () => {
      if (destroyed || !player) {
        return
      }

      stopWatchingReady?.()

      if (ready) {
        // Ready again: its page reloaded (moved by a browser that cannot
        // move it in place). It starts over, cued at the link's start:
        // back where it was, playing if it was.
        reloaded = true
        state = YOUTUBE_STATE.UNSTARTED
        target = null
        labelFrame()
        applyMuted(false)
        standAt(last, wanted)
        onChange()

        return
      }

      ready = true
      labelFrame()
      applyMuted(false)
      unwatch = deps.watchFrame?.(player.getIframe())

      // Ready at last, after the wait said YouTube did not answer.
      if (timedOut) {
        timedOut = false
        failure = null
      }

      // Elsewhere than the link's start (a reload of the projected screen):
      // there, playing if asked, in one command (a cue then a play loses
      // the play).
      if (cued !== (video?.start ?? 0)) {
        standAt(cued, wanted)
      } else if (wanted) {
        player.playVideo()
      }

      poll = setInterval(() => {
        readState()

        if (player && ready && state !== YOUTUBE_STATE.UNSTARTED) {
          last = readPosition()
        }

        onChange()
      }, POLL_INTERVAL)
      onChange()
    }

    if (video) {
      deps
        .loadApi()
        .then((api) => {
          if (destroyed) {
            return
          }

          player = new api.Player(mount, {
            host: YOUTUBE_PLAYER_HOST,
            videoId: video.id,
            width: "100%",
            height: "100%",
            playerVars: deps.playerVars(video.start),
            events: {
              onReady: handleReady,
              onStateChange: handleState,
              onError: ({ data }) => {
                if (destroyed) {
                  return
                }

                const reason = youtubeFailureOf(data)

                fail(reason)

                if (reason === YOUTUBE_FAILURES.NOT_EMBEDDABLE) {
                  askPage()
                }
              },
              onAutoplayBlocked: () => {
                if (!destroyed) {
                  wanted = false
                  settle(notAllowed())
                  onChange()
                }
              },
            },
          })
          stopWatchingReady = watchReady(
            () => box.isConnected,
            () => {
              if (!destroyed && !ready && failure === null) {
                timedOut = true
                fail(YOUTUBE_FAILURES.UNREACHABLE)
              }
            },
          )
        })
        .catch(() => {
          if (!destroyed) {
            fail(YOUTUBE_FAILURES.UNREACHABLE)
          }
        })
    }

    const driver: MediaDriver = {
      element: box,
      get paused() {
        return !(
          state === YOUTUBE_STATE.PLAYING ||
          (state === YOUTUBE_STATE.BUFFERING && wanted)
        )
      },
      get ended() {
        return state === YOUTUBE_STATE.ENDED
      },
      get position() {
        return readPosition()
      },
      // In whole seconds, as YouTube's own bar shows it (139.9 reads 2:20
      // there): the host's clock under it says the same.
      get duration() {
        const duration = ready ? (player?.getDuration() ?? 0) : 0

        return duration > 0 ? Math.round(duration) : null
      },
      get failed() {
        return failure !== null
      },
      get failure() {
        return failure
      },
      play: () => {
        if (failure) {
          return Promise.reject(new Error(`YouTube: ${failure}`))
        }

        wanted = true

        const played = new Promise<void>((resolve, reject) => {
          waiters.push({ resolve, reject })
        })

        if (player && ready) {
          player.playVideo()
        }

        return played
      },
      pause: () => {
        wanted = false

        if (player && ready) {
          player.pauseVideo()
        }

        settle(aborted())
      },
      seek: (seconds) => {
        last = seconds

        if (!player || !ready) {
          cued = seconds

          return
        }

        // A video that does not play (not started, over) plays once sought:
        // cued there instead, unless the host wants it playing.
        const still =
          state === YOUTUBE_STATE.UNSTARTED ||
          state === YOUTUBE_STATE.CUED ||
          state === YOUTUBE_STATE.ENDED

        if (still) {
          standAt(seconds, wanted)
        } else {
          player.seekTo(seconds, true)
          target = { seconds, at: now() }
        }

        onChange()
      },
      setLabel: (value) => {
        label = value
        labelFrame()
      },
      get muted() {
        return muted
      },
      setMuted: (value) => {
        muted = value
        applyMuted(true)
        onChange()
      },
      destroy: () => {
        destroyed = true
        pageCheck.abort()
        clearInterval(poll)
        stopWatchingReady?.()
        unwatch?.()
        settle(aborted())

        try {
          player?.destroy()
        } catch {
          // Its page already gone.
        }

        player = null
        box.remove()
      },
    }

    return driver
  }

// The box of the projected screen's player: the <iframe> fills it, black
// around the picture once full screen.
const createBox = () => {
  const box = document.createElement("div")
  const mount = document.createElement("div")

  box.className = "size-full [&:fullscreen]:bg-black [&>iframe]:block"
  box.append(mount)

  return { box, mount }
}

// How soon after a Tab the page loses the focus when the Tab took it into
// the player: at once, in the same task. A click in the player a moment
// after a Tab is a click.
const TAB_WINDOW = 100

/**
 * A click in YouTube's player gives it the keyboard's focus: the page's keys
 * (the presentation remote, K, F) would go to the player, which ignores
 * them. Once the click is done, the focus comes back to the page. A Tab into
 * the player (the keyboard's way to its captions, its volume) leaves it
 * there. A click in the player reaches no listener of the page: only a focus
 * lost right after a Tab is the keyboard's.
 */
export const handFocusBack = (
  frame: HTMLIFrameElement,
  now: () => number = Date.now,
) => {
  let tabbedAt = Number.NEGATIVE_INFINITY

  const handleKeyDown = (event: KeyboardEvent) => {
    tabbedAt = event.key === "Tab" ? now() : Number.NEGATIVE_INFINITY
  }

  const handlePointerDown = () => {
    tabbedAt = Number.NEGATIVE_INFINITY
  }

  const handleBlur = () => {
    const byKeyboard = now() - tabbedAt <= TAB_WINDOW

    tabbedAt = Number.NEGATIVE_INFINITY
    window.setTimeout(() => {
      if (!byKeyboard && document.activeElement === frame) {
        frame.blur()
      }
    }, 0)
  }

  window.addEventListener("keydown", handleKeyDown, true)
  window.addEventListener("pointerdown", handlePointerDown, true)
  window.addEventListener("blur", handleBlur)

  return () => {
    window.removeEventListener("keydown", handleKeyDown, true)
    window.removeEventListener("pointerdown", handlePointerDown, true)
    window.removeEventListener("blur", handleBlur)
  }
}

/** YouTube's player on the projected screen. */
export const createYoutubeDriver: CreateDriver = youtubeDriver({
  loadApi: loadYoutubeApi,
  createBox,
  playerVars: (start) => youtubePlayerVars(start, { projected: true }),
  watchFrame: (frame) => handFocusBack(frame),
  pageStatus: youtubePageStatus,
})

/**
 * YouTube's player on a phone that follows the host's screen: loaded only
 * once its user asked (« Regarder ici »), without YouTube's bar. Its page is
 * never asked why a video fails: the phone points to the screen then.
 */
export const createDeviceYoutubeDriver: CreateDriver = youtubeDriver({
  loadApi: loadYoutubeApi,
  createBox,
  playerVars: (start) =>
    youtubePlayerVars(start, { projected: false, device: true }),
})
