import { MEDIA_TYPES } from "@razzia/common/constants"
import type {
  CreateDriver,
  MediaDriver,
} from "@razzia/web/features/game/media/controller"

// Every event after which the player may read differently.
const EVENTS = [
  "play",
  "playing",
  "pause",
  "ended",
  "timeupdate",
  "durationchange",
  "loadedmetadata",
  "seeked",
  "error",
  "emptied",
] as const

/**
 * A video or a sound file, played by a <video> or <audio> element without the
 * browser's controls (the host's own are under it, see HostMediaPlayer): no
 * control to catch the focus, so the presentation remote keeps moving the
 * game on. Loaded whole in advance, so it starts at once; inline on an
 * iPhone. In a box of its own, which the stage moves and puts full screen
 * (see MediaDriver.element).
 */
export const createFileDriver: CreateDriver = ({ kind, url }, onChange) => {
  const box = document.createElement("div")
  const element = document.createElement(
    kind === MEDIA_TYPES.VIDEO ? "video" : "audio",
  )
  // A position asked for before the length is known, applied once it is.
  let pendingSeek: number | null = null

  element.preload = "auto"
  element.controls = false
  element.className =
    kind === MEDIA_TYPES.VIDEO ? "block size-full object-contain" : "hidden"
  // Black around the picture once full screen.
  box.className = "size-full [&:fullscreen]:bg-black"
  box.append(element)

  if (element instanceof HTMLVideoElement) {
    element.playsInline = true
    element.disablePictureInPicture = true
  }

  const applyPendingSeek = () => {
    if (pendingSeek !== null) {
      element.currentTime = pendingSeek
      pendingSeek = null
    }
  }

  element.addEventListener("loadedmetadata", applyPendingSeek)
  EVENTS.forEach((type) => {
    element.addEventListener(type, onChange)
  })
  element.src = url

  const driver: MediaDriver = {
    element: box,
    get paused() {
      return element.paused
    },
    get ended() {
      return element.ended
    },
    get position() {
      return pendingSeek ?? element.currentTime
    },
    get duration() {
      return Number.isFinite(element.duration) ? element.duration : null
    },
    get failed() {
      return element.error !== null
    },
    play: async () => {
      await element.play()
    },
    pause: () => {
      element.pause()
    },
    seek: (seconds) => {
      if (element.readyState >= HTMLMediaElement.HAVE_METADATA) {
        element.currentTime = seconds
      } else {
        pendingSeek = seconds
      }
    },
    setLabel: (label) => {
      element.setAttribute("aria-label", label)
    },
    destroy: () => {
      element.removeEventListener("loadedmetadata", applyPendingSeek)
      EVENTS.forEach((type) => {
        element.removeEventListener(type, onChange)
      })
      element.pause()
      // Stops the download too.
      element.removeAttribute("src")
      element.load()
      box.remove()
    },
  }

  return driver
}
