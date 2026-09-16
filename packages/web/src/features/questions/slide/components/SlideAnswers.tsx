import { AnswerReveal } from "@razzia/web/features/game/components/question/AnswerRow"
import type { AnswerComponentProps } from "@razzia/web/features/questions/types"
import { Presentation } from "lucide-react"
import { useTranslation } from "react-i18next"

// An info slide has nothing to answer. The host stage shows the slide itself;
// the phone shows a card pointing to the screen.
const SlideAnswers = ({ readOnly }: AnswerComponentProps) => {
  const { t } = useTranslation()

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
      <p className="text-lg font-semibold">{t("game:slideInfo")}</p>
      <p className="text-white/80">{t("game:answer.slideHint")}</p>
    </AnswerReveal>
  )
}

export default SlideAnswers
