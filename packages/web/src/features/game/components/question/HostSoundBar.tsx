import {
  MediaTimeline,
  MediaToggle,
  RestartControl,
  RetryControl,
} from "@razzia/web/features/game/components/question/HostMediaControls"
import { useHostMediaState } from "@razzia/web/features/game/media/host-media"
import {
  parkMediaElement,
  placeMediaElement,
} from "@razzia/web/features/game/media/stage"
import { Music, VolumeX } from "lucide-react"
import { useLayoutEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

/**
 * The sound of the question on the projected screen, in the host's dock
 * (HostDock), by « Passer » or « Suivant »: back to the start, play or pause,
 * where it is. It has nothing to show, so it takes no room from the question,
 * and stays in place, focus included, from the reading time to the
 * distribution. Nothing without a sound.
 */
const HostSoundBar = () => {
  const { t } = useTranslation()
  const state = useHostMediaState()
  const slotRef = useRef<HTMLDivElement>(null)
  const element = state.source?.kind === "audio" ? state.element : null
  const ready = element !== null

  useLayoutEffect(() => {
    const slot = slotRef.current

    if (!slot || !element) {
      return
    }

    placeMediaElement(element, slot)

    return () => {
      if (element.parentNode === slot) {
        parkMediaElement(element)
      }
    }
  }, [element])

  if (!element) {
    return null
  }

  return (
    // Over the rows of a screen too long for the projector, the navy of the
    // phone's band rather than a veil (stuck, see HostDock).
    <div className="stuck:bg-secondary stuck:shadow-lg stuck:shadow-black/20 pointer-events-auto mr-auto flex min-h-13 max-w-3xl min-w-0 flex-1 items-center gap-3 rounded-full bg-black/25 py-1 pr-5 pl-4">
      <div ref={slotRef} hidden />
      {state.failed ? (
        <>
          <p className="flex flex-1 items-center gap-2 font-semibold text-white/70 lg:text-lg">
            <VolumeX aria-hidden className="size-6 shrink-0" />
            {t("game:media.audioUnavailable")}
          </p>
          <RetryControl />
        </>
      ) : (
        <div
          role="group"
          aria-label={t("game:media.audioControls")}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <Music aria-hidden className="size-6 shrink-0 text-white/70" />
          <RestartControl ready={ready} />
          <MediaToggle kind="audio" state={state} ready={ready} />
          <MediaTimeline
            state={state}
            ready={ready}
            className="min-w-0 flex-1"
          />
        </div>
      )}
    </div>
  )
}

export default HostSoundBar
