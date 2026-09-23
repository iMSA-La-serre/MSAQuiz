import { MEDIA_TYPES } from "@razzia/common/constants"
import type { StatusDataMap } from "@razzia/common/types/game/status"
import { isVideoMedia } from "@razzia/common/utils/media"
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
