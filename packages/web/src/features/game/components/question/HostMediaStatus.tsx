import { MEDIA_TYPES } from "@razzia/common/constants"
import { useHostMediaState } from "@razzia/web/features/game/media/host-media"
import { useTranslation } from "react-i18next"

/**
 * Read out when the question's video or sound needs the host: the browser
 * refused to play it on its own, or it did not load. One live region for the
 * whole game (in HostDock), which no screen of the question mounts anew: a
 * message is read once, when it comes, never again when the next screen
 * shows it.
 */
const HostMediaStatus = () => {
  const { t } = useTranslation()
  const { source, blocked, failed, failure } = useHostMediaState()
  let message = ""

  if (source && failed) {
    message = t(
      source.kind === MEDIA_TYPES.AUDIO
        ? "game:media.audioUnavailable"
        : "game:media.videoUnavailable",
    )

    // YouTube's player says why.
    if (source.kind === MEDIA_TYPES.YOUTUBE && failure) {
      message = `${message}. ${t(`game:media.youtube.${failure}`)}`
    }
  } else if (source && blocked) {
    message = t("game:media.blocked")
  }

  return (
    <p role="status" className="sr-only">
      {message}
    </p>
  )
}

export default HostMediaStatus
