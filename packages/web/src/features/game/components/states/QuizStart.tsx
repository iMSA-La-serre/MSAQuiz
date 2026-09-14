import { EVENTS } from "@razzia/common/constants"
import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import { useEvent } from "@razzia/web/features/game/contexts/socket-context"
import { SFX } from "@razzia/web/features/game/utils/constants"
import clsx from "clsx"
import { motion, MotionConfig } from "motion/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"

interface Props {
  data: CommonStatusDataMap["SHOW_START"]
}

// Each second of the countdown plays the same wooden "tok", a whole tone
// higher than the one before.
const TICK_RATES = [1, 2 ** (2 / 12), 2 ** (4 / 12)]

const QuizStart = ({ data: { time, subject } }: Props) => {
  const { t } = useTranslation()
  // Seconds before the first question, or null while the title stands alone.
  const [remaining, setRemaining] = useState<number | null>(null)
  const [playTick] = useSound(SFX.BOUMP_SOUND, { volume: 0.2 })

  const tick = (seconds: number) => {
    const step = Math.min(Math.max(time - seconds, 0), TICK_RATES.length - 1)

    playTick({ playbackRate: TICK_RATES[step] })
    setRemaining(seconds)
  }

  useEvent(EVENTS.GAME.START_COOLDOWN, () => tick(time))

  useEvent(EVENTS.GAME.COOLDOWN, (seconds) => tick(seconds))

  // How many one-second segments have started filling.
  const started = remaining === null ? 0 : time - remaining + 1

  return (
    <MotionConfig reducedMotion="user">
      <section className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <p className="text-sm font-semibold tracking-[0.2em] text-white/70 uppercase md:text-base">
            {t("game:start.eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-bold text-balance text-white drop-shadow-lg md:text-5xl">
            {subject}
          </h2>
        </motion.div>

        {/* The live region stays in the accessibility tree from the start, so
        the first "3 s" is announced; only the decorative segments are hidden. */}
        <div
          className={clsx(
            "flex w-full max-w-md flex-col items-center gap-3 transition-opacity duration-300 md:max-w-2xl md:gap-5",
            remaining === null ? "opacity-0" : "opacity-100",
          )}
        >
          <div aria-hidden className="flex w-full gap-2">
            {Array.from({ length: time }, (_, index) => (
              <div
                key={index}
                className="h-2 flex-1 overflow-hidden rounded-full bg-white/20 md:h-4"
              >
                <div
                  className={clsx(
                    "bg-primary h-full rounded-full transition-[width] duration-1000 ease-linear motion-reduce:transition-none",
                    index < started ? "w-full" : "w-0",
                  )}
                />
              </div>
            ))}
          </div>
          <p
            aria-live="polite"
            className="text-lg font-semibold text-white/80 tabular-nums md:text-3xl md:text-white"
          >
            {remaining !== null &&
              t("game:start.firstQuestionIn", { count: remaining })}
          </p>
        </div>
      </section>
    </MotionConfig>
  )
}

export default QuizStart
