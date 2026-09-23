import { MEDIA_TYPES } from "@razzia/common/constants"
import type { TimedMediaType } from "@razzia/common/types/game"
import {
  keepFocus,
  takeFocus,
} from "@razzia/web/features/game/media/device-focus"
import { MonitorPlay, Volume2 } from "lucide-react"
import { useLayoutEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  type: TimedMediaType
}

const CONTENT = {
  [MEDIA_TYPES.VIDEO]: {
    icon: MonitorPlay,
    title: "game:media.watchScreen",
    hint: "game:media.watchScreenHint",
  },
  // A YouTube video too: the phone never contacts YouTube.
  [MEDIA_TYPES.YOUTUBE]: {
    icon: MonitorPlay,
    title: "game:media.watchScreen",
    hint: "game:media.watchScreenHint",
  },
  [MEDIA_TYPES.AUDIO]: {
    icon: Volume2,
    title: "game:media.listen",
    hint: "game:media.listenHint",
  },
} as const

/**
 * On a phone, in the place of the question's video or sound, which plays on
 * the projected screen: the phone never loads it, and says where to look or
 * listen. The look of a slide's card (SlideAnswers), on one row to leave the
 * answers their room. It takes the focus from « Non, je regarde l'écran »
 * or « Ne plus regarder ici », which it replaces (a video on every device),
 * and keeps it from one screen of the question to the next.
 */
const ScreenMediaCard = ({ type }: Props) => {
  const { t } = useTranslation()
  const { icon: Icon, title, hint } = CONTENT[type]
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const card = ref.current

    if (takeFocus("screen")) {
      card?.focus({ preventScroll: true })
    }

    return () => {
      if (card && document.activeElement === card) {
        keepFocus("screen")
      }
    }
  }, [])

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="flex items-center gap-3 rounded-2xl bg-black/25 px-4 py-3 text-white backdrop-blur-sm outline-none"
    >
      <Icon aria-hidden className="size-8 shrink-0 text-white/70" />
      <p className="flex flex-col">
        <span className="text-lg font-semibold">{t(title)}</span>
        <span className="text-sm text-white/80">{t(hint)}</span>
      </p>
    </div>
  )
}

export default ScreenMediaCard
