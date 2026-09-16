import type { PlayerStatusDataMap } from "@razzia/common/types/game/status"
import Loader from "@razzia/web/components/Loader"
import AnswerChip from "@razzia/web/features/game/components/AnswerChip"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import { useTranslation } from "react-i18next"

interface Props {
  data: PlayerStatusDataMap["WAIT"]
}

const Wait = ({ data: { text } }: Props) => {
  const { t } = useTranslation()
  const lastAnswer = useQuestionStore((state) => state.lastAnswer)
  const sentAnswer =
    text === "game:waitingForAnswers" && lastAnswer
      ? [...lastAnswer].sort((a, b) => a - b)
      : null

  return (
    <section className="anim-show mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-4 text-center">
      <Loader className="size-16 md:size-20" />

      {sentAnswer && (
        <>
          <p className="text-sm font-semibold tracking-[0.2em] text-white/70 uppercase">
            {t("game:wait.sent")}
          </p>
          {/* A white tray: the deep green C chip would vanish on the navy
          background. */}
          <div className="flex gap-2 rounded-2xl bg-white p-2 shadow-lg shadow-black/15">
            {sentAnswer.map((key) => (
              <AnswerChip key={key} index={key} size="lg" />
            ))}
          </div>
        </>
      )}

      <h2 className="text-2xl font-bold text-balance text-white md:text-4xl">
        {t(text)}
      </h2>
    </section>
  )
}

export default Wait
