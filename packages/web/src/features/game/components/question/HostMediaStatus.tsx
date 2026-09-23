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
  const { source, blocked, failed } = useHostMediaState()
  let message = ""

  if (source && failed) {
    message = t(
      source.kind === "video"
        ? "game:media.videoUnavailable"
        : "game:media.audioUnavailable",
    )
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
