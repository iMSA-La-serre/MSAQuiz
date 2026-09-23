import { EVENTS, MEDIA_TYPES } from "@razzia/common/constants"
import type { MediaViewers } from "@razzia/common/types/game"
import type { StatusDataMap } from "@razzia/common/types/game/status"
import { isVideoMedia } from "@razzia/common/utils/media"
import {
  socketClient,
  useEvent,
} from "@razzia/web/features/game/contexts/socket-context"
import {
  type CreateDriver,
  MediaController,
} from "@razzia/web/features/game/media/controller"
import { createFileDriver } from "@razzia/web/features/game/media/file-driver"
import { toggleFullscreen } from "@razzia/web/features/game/media/fullscreen"
import { sessionMemory } from "@razzia/web/features/game/media/memory"
import {
  hostMediaKey,
  hostMediaPlan,
} from "@razzia/web/features/game/media/plan"
import type { Status } from "@razzia/web/features/game/utils/createStatus"
import { PlaybackRelay } from "@razzia/web/features/game/media/relay"
import { createYoutubeDriver } from "@razzia/web/features/game/media/youtube-driver"
import { isTypingTarget } from "@razzia/web/features/game/utils/keys"
import { useEffect, useSyncExternalStore } from "react"

// A file's player, or YouTube's for a YouTube video.
const createHostDriver: CreateDriver = (source, onChange) =>
  source.kind === MEDIA_TYPES.YOUTUBE
    ? createYoutubeDriver(source, onChange)
    : createFileDriver(source, onChange)

/**
 * The media the projected screen plays: one at a time, for the whole page, so
 * it goes on playing from one screen of its question to the next.
 */
export const hostMedia = new MediaController(createHostDriver, sessionMemory())

// Play and pause, full screen, from the keyboard, as on the video sites.
export const TOGGLE_KEY = "k"

export const FULLSCREEN_KEY = "f"

/** What the host's player shows, kept up to date. */
export const useHostMediaState = () =>
  useSyncExternalStore(hostMedia.subscribe, hostMedia.getState)

/**
 * Follows the host's screens: loads the video or the sound of the question
 * (a reload picks it up where it was), starts it when its screen says so,
 * and drops it once the question is over. Rendering it is up to the stage
 * (HostMediaPlayer), wherever the screen puts it.
 */
export const useHostMediaSync = (
  status: Status<StatusDataMap> | null,
  gameId: string | null,
  questionNumber: number | undefined,
) => {
  const plan = hostMediaPlan(status)
  const kind = plan?.source.kind
  const url = plan?.source.url
  const start = plan?.source.start
  const autoplay = plan?.autoplay ?? false
  const label = plan?.label ?? ""
  const key =
    url === undefined ? null : hostMediaKey(gameId, questionNumber, url)

  useEffect(() => {
    if (key === null || kind === undefined || url === undefined) {
      hostMedia.finish()

      return
    }

    hostMedia.setLabel(label)
    hostMedia.load(key, { kind, url, start })

    if (autoplay) {
      hostMedia.autoplay()
    }
  }, [key, kind, url, start, autoplay, label])

  // Leaving the page drops the player; the development double mount finds it
  // back where it was.
  useEffect(
    () => () => {
      hostMedia.release()
    },
    [],
  )
}

/**
 * K plays or pauses the media of the question, F puts its video full screen
 * or leaves it, whatever screen of the question shows it and wherever the
 * focus is (but in a field).
 */
export const useHostMediaKeys = () => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modified =
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
      const key = event.key.toLowerCase()
      const { element, source } = hostMedia.getState()

      if (
        (key !== TOGGLE_KEY && key !== FULLSCREEN_KEY) ||
        element === null ||
        modified ||
        event.repeat ||
        event.defaultPrevented ||
        isTypingTarget(event.target)
      ) {
        return
      }

      if (key === TOGGLE_KEY) {
        event.preventDefault()
        hostMedia.toggle()
      } else if (source && isVideoMedia(source.kind)) {
        event.preventDefault()
        toggleFullscreen(element)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])
}

// Where the relay sends to: the game, while its question's video plays on
// every device.
let relayTarget: { gameId: string; url: string } | null = null

// The host's video, told to the server for the phones that follow it.
const relay = new PlaybackRelay(
  (playing, position) => {
    if (relayTarget) {
      socketClient.emit(EVENTS.MANAGER.MEDIA_CONTROL, {
        gameId: relayTarget.gameId,
        playing,
        // To the millisecond.
        position: Math.round(position * 1000) / 1000,
      })
    }
  },
  () => performance.now(),
)

// Reads the host's player for the relay, when it is the question's video
// that plays on every device.
const relayHostMedia = () => {
  const state = hostMedia.getState()

  if (relayTarget && state.source?.url === relayTarget.url) {
    relay.update(state)
  }
}

// How many phones show the question's video, as the server counts them.
let viewers: MediaViewers | null = null
const viewersListeners = new Set<() => void>()

const subscribeViewers = (listener: () => void) => {
  viewersListeners.add(listener)

  return () => {
    viewersListeners.delete(listener)
  }
}

/** How many phones show the video of `question`, 0 until the server says. */
export const useMediaViewers = (question: number | undefined): number => {
  const current = useSyncExternalStore(subscribeViewers, () => viewers)

  return current !== null && current.question === question ? current.count : 0
}

/**
 * Follows the question's video when it plays on every device: tells the
 * server whenever the host's player plays, pauses or moves (PlaybackRelay),
 * again once the connection is back (the server paused it for everyone
 * meanwhile), and keeps how many phones show it.
 */
export const useDevicesRelay = (
  status: Status<StatusDataMap> | null,
  gameId: string | null,
) => {
  const plan = hostMediaPlan(status)
  const url = plan?.devices && gameId ? plan.source.url : null

  useEffect(() => {
    if (url === null || gameId === null) {
      relayTarget = null

      return
    }

    relayTarget = { gameId, url }
    relayHostMedia()

    const unsubscribe = hostMedia.subscribe(relayHostMedia)

    return () => {
      unsubscribe()
      relayTarget = null
    }
  }, [url, gameId])

  useEvent(EVENTS.MANAGER.SUCCESS_RECONNECT, () => {
    relay.reset()
    relayHostMedia()
  })

  useEvent(EVENTS.MANAGER.MEDIA_VIEWERS, (next) => {
    viewers = next
    viewersListeners.forEach((listener) => {
      listener()
    })
  })
}
