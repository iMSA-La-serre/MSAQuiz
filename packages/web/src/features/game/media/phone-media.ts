import { EVENTS, MEDIA_TYPES } from "@razzia/common/constants"
import type { StatusDataMap } from "@razzia/common/types/game/status"
import {
  socketClient,
  useEvent,
} from "@razzia/web/features/game/contexts/socket-context"
import type { CreateDriver } from "@razzia/web/features/game/media/controller"
import { DeviceMedia } from "@razzia/web/features/game/media/device-media"
import { createFileDriver } from "@razzia/web/features/game/media/file-driver"
import { devicePlan } from "@razzia/web/features/game/media/plan"
import {
  measureServerClock,
  ServerClock,
} from "@razzia/web/features/game/media/server-clock"
import { createDeviceYoutubeDriver } from "@razzia/web/features/game/media/youtube-driver"
import type { Status } from "@razzia/web/features/game/utils/createStatus"
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"

// How long the server has to answer a clock request.
const CLOCK_TIMEOUT = 2000

// A file's player, or YouTube's without its bar.
const createPhoneDriver: CreateDriver = (source, onChange) =>
  source.kind === MEDIA_TYPES.YOUTUBE
    ? createDeviceYoutubeDriver(source, onChange)
    : createFileDriver(source, onChange)

const local = () => performance.now()

/** The server's clock, as this phone estimates it. */
export const serverClock = new ServerClock({ local, epoch: Date.now })

let measuring: Promise<void> | null = null

// Measures the server's clock, once at a time. Each answer moves the
// phone's player at once (a measure in doubt holds it, see
// ServerClock.pending); a measure without any answer leaves the kept one.
const measureClock = () => {
  measuring ??= measureServerClock({
    clock: serverClock,
    ask: () =>
      socketClient
        .timeout(CLOCK_TIMEOUT)
        .emitWithAck(EVENTS.GAME.CLOCK, Date.now()),
    local,
    wait: (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms)
      }),
    onRecord: () => {
      deviceMedia.refresh()
    },
  }).finally(() => {
    measuring = null
    serverClock.settle()
  })
}

/**
 * The phone's copy of the video that plays on every device: one for the
 * page, so it goes on from the reading time to the answers, to the waiting
 * screen once its player answered, and to the result.
 */
export const deviceMedia = new DeviceMedia({
  createDriver: createPhoneDriver,
  serverNow: () => serverClock.now(),
  local,
  visible: () => document.visibilityState === "visible",
  syncClock: () => {
    if (serverClock.isStale()) {
      measureClock()
    }
  },
  clockPending: () => serverClock.pending,
})

/** What the phone chose, and the host's word. */
export const useDeviceMedia = () =>
  useSyncExternalStore(deviceMedia.subscribe, deviceMedia.getSnapshot)

/** What the phone's player does. */
export const useDevicePlayer = () =>
  useSyncExternalStore(
    deviceMedia.controller.subscribe,
    deviceMedia.controller.getState,
  )

/**
 * Follows the phone's screens: the video that plays on every device, from
 * its question's reading time to the waiting screen once answered and to
 * the result (after a reload, from the server's word); the server's word
 * about it; and tells the server whether the phone shows it (counted on the
 * host's screen). Leaving the game drops it all.
 */
export const useDeviceMediaSync = (
  status: Status<StatusDataMap> | null,
  gameId: string | null,
  question: number | undefined,
) => {
  const { t } = useTranslation()
  // Names the player when the screen does not tell the question's wording
  // (a reload on the waiting screen, or on the result).
  const label = t("game:media.devices.player")
  const screen = useRef({ status, gameId, question, label })
  const told = useRef<{ key: string | null; watching: boolean }>({
    key: null,
    watching: false,
  })

  // The same video changes nothing (DeviceMedia.show).
  const showPlan = useCallback(() => {
    const { status: shown, gameId: game, question: current } = screen.current

    deviceMedia.show(
      devicePlan(shown, {
        gameId: game,
        question: current,
        previous: deviceMedia.getSnapshot().plan,
        state: deviceMedia.lastState(),
        label: screen.current.label,
      }),
    )
  }, [])

  useEffect(() => {
    screen.current = { status, gameId, question, label }
    showPlan()
  }, [status, gameId, question, label, showPlan])

  // The server's word: a screen that does not carry the video may find it
  // there (a reload on the waiting screen).
  useEvent(EVENTS.GAME.MEDIA_STATE, (state) => {
    deviceMedia.receive(state)
    showPlan()
  })

  // The phone shows the video, or no longer does: the server counts it. A
  // player that could not load it (a file out of the phone's reach, YouTube
  // blocked) is not counted.
  useEffect(() => {
    const tell = () => {
      const { key: shown, choice } = deviceMedia.getSnapshot()
      const { failed } = deviceMedia.controller.getState()
      const watching = choice === "watch" && shown !== null && !failed
      const last = told.current

      if (!gameId || (last.watching === watching && last.key === shown)) {
        return
      }

      told.current = { key: shown, watching }

      // Another video, or none: the one it showed is no longer shown.
      if (last.watching || watching) {
        socketClient.emit(EVENTS.PLAYER.MEDIA_WATCH, { gameId, watching })
      }
    }

    tell()

    const stopMedia = deviceMedia.subscribe(tell)
    const stopPlayer = deviceMedia.controller.subscribe(tell)

    return () => {
      stopMedia()
      stopPlayer()
    }
  }, [gameId])

  // Back on a new connection: its clock is in doubt until measured again,
  // and the server told again that the phone shows the video.
  useEvent(EVENTS.PLAYER.SUCCESS_RECONNECT, ({ gameId: back }) => {
    serverClock.doubt()

    if (deviceMedia.watching) {
      measureClock()

      if (told.current.watching) {
        socketClient.emit(EVENTS.PLAYER.MEDIA_WATCH, {
          gameId: back,
          watching: true,
        })
      }
    }
  })

  // Shown again: in step at once, once its clock is measured again (a
  // phone's monotonic clock may stop while it sleeps, screen locked).
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && deviceMedia.watching) {
        serverClock.doubt()
        measureClock()
      }

      deviceMedia.refresh()
    }

    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [])

  useEffect(
    () => () => {
      deviceMedia.reset()
    },
    [],
  )
}
