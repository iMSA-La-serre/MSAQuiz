import { AnswerReveal } from "@razzia/web/features/game/components/question/AnswerRow"
import {
  keepFocus,
  takeFocus,
} from "@razzia/web/features/game/media/device-focus"
import type { AnswerComponentProps } from "@razzia/web/features/questions/types"
import { Presentation } from "lucide-react"
import { useLayoutEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

const HINTS = {
  video: "game:answer.slideVideoHint",
  youtube: "game:answer.slideVideoHint",
  audio: "game:answer.slideAudioHint",
} as const

// An info slide has nothing to answer. The host stage shows the slide itself;
// the phone shows a card pointing to the screen, and to its video or its
// sound, which play there (the one card: no « Regardez l'écran » card above
// it). A video on every device that its participant stops watching, or
// declines, comes back here: the card then takes the focus, and keeps it
// when the answers open (the stage remounts).
const SlideAnswers = ({ readOnly, screenMedia }: AnswerComponentProps) => {
  const { t } = useTranslation()
  const titleRef = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const title = titleRef.current

    if (screenMedia && takeFocus("screen")) {
      title?.focus({ preventScroll: true })
    }

    return () => {
      if (title && document.activeElement === title) {
        keepFocus("screen")
      }
    }
  }, [screenMedia])

  if (readOnly) {
    return null
  }

  return (
    <AnswerReveal
      index={0}
      as="div"
      className="mt-auto flex flex-col items-center gap-2 rounded-2xl bg-black/25 p-5 text-center text-white backdrop-blur-sm"
    >
      <Presentation aria-hidden className="size-8 text-white/70" />
      <p
        ref={titleRef}
        tabIndex={-1}
        className="text-lg font-semibold outline-none"
      >
        {t("game:slideInfo")}
      </p>
      <p className="text-white/80">
        {t(screenMedia ? HINTS[screenMedia] : "game:answer.slideHint")}
      </p>
    </AnswerReveal>
  )
}

export default SlideAnswers
