import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import { motion, MotionConfig } from "motion/react"
import { useTranslation } from "react-i18next"

interface Props {
  data: CommonStatusDataMap["SHOW_PREPARED"]
}

const QuestionIntro = ({ data: { questionNumber, questionType } }: Props) => {
  const { t } = useTranslation()
  const { questionStates } = useQuestionStore()
  const total = questionStates?.total ?? null

  return (
    <MotionConfig reducedMotion="user">
      <section className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold tracking-wide text-white md:text-base"
        >
          {t(`quizz:questionType.${questionType}`)}
        </motion.span>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-4xl font-bold text-white drop-shadow-lg md:text-6xl"
        >
          {t("game:prepared.title", { number: questionNumber })}{" "}
          {total !== null && (
            <span className="ml-3 text-2xl font-semibold text-white/60 md:text-4xl">
              {t("game:prepared.outOf", { total })}
            </span>
          )}
        </motion.h2>

        {/* The bar moves from the previous question to this one: it shows
        progress through the quiz, not a timer. */}
        {total !== null && (
          <div
            role="progressbar"
            aria-label={t("game:prepared.title", { number: questionNumber })}
            aria-valuetext={`${questionNumber} / ${total}`}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={questionNumber}
            className="h-2 w-full max-w-md overflow-hidden rounded-full bg-white/20"
          >
            <motion.div
              initial={{ width: `${((questionNumber - 1) / total) * 100}%` }}
              animate={{
                width: `${Math.min(questionNumber / total, 1) * 100}%`,
              }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="bg-primary h-full rounded-full"
            />
          </div>
        )}
      </section>
    </MotionConfig>
  )
}

export default QuestionIntro
