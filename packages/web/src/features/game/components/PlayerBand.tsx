import { MEDIA_TYPES } from "@razzia/common/constants"
import { useDeviceMedia } from "@razzia/web/features/game/media/phone-media"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { initial } from "@razzia/web/features/game/utils/initial"
import clsx from "clsx"
import { useTranslation } from "react-i18next"

// Identity and score at the top of every phone screen, lobby wait included,
// kept in view while the page scrolls. Not over YouTube's player, which
// nothing may cover (YouTube's rules): while the phone shows one, the band
// scrolls away with the page.
const PlayerBand = () => {
  const player = usePlayerStore((state) => state.player)
  const { plan, choice } = useDeviceMedia()
  const { t, i18n } = useTranslation()
  const youtube =
    choice === "watch" && plan?.source.kind === MEDIA_TYPES.YOUTUBE
  const username = player?.username ?? ""
  const points = new Intl.NumberFormat(i18n.language).format(
    player?.points ?? 0,
  )

  return (
    <header
      className={clsx(
        "bg-secondary z-40 flex items-center gap-3 border-b border-white/10 px-4 py-2.5 text-white shadow-lg shadow-black/20",
        youtube ? "relative" : "sticky top-0",
      )}
    >
      {/* Decorative: the name is right next to it. 20 px bold, because white
      on green is readable only as large text. */}
      <span
        aria-hidden
        className="bg-primary flex size-9 shrink-0 items-center justify-center rounded-full text-xl font-bold"
      >
        {initial(username)}
      </span>
      <p className="min-w-0 flex-1 truncate text-lg font-semibold">
        {username}
      </p>
      <p className="shrink-0 text-xl font-bold tabular-nums">
        <span className="sr-only">{t("game:band.score")} </span>
        {points}
        <span className="ml-1 text-base font-semibold text-white/75">
          {t("game:finale.points")}
        </span>
      </p>
    </header>
  )
}

export default PlayerBand
