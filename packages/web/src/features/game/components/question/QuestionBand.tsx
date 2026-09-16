import { NO_TIME_LIMIT } from "@razzia/common/constants"
import type { QuestionType } from "@razzia/common/types/game"
import HintChip from "@razzia/web/features/game/components/question/HintChip"
import QuestionProgress from "@razzia/web/features/game/components/question/QuestionProgress"
import TimerRing from "@razzia/web/features/game/components/question/TimerRing"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import clsx from "clsx"
import { Eye, Infinity as InfinityIcon } from "lucide-react"
import { useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  variant: "host" | "phone"
  questionType: QuestionType
  phase: "reading" | "answering" | "results"
  time: number
  cooldown?: number
  // Seconds shown in the ring: reading or answer time left, null without a
  // limit.
  remaining: number | null
  answered?: number
  totalPlayers?: number
}

// From this many seconds left, the answer ring turns yellow.
const WARNING_SECONDS = 5

// Seconds left announced on the phone, besides the opening of the answers.
const ANNOUNCED_SECONDS = [WARNING_SECONDS, 10]

const TYPE_CHIP =
  "rounded-full bg-white/15 font-semibold tracking-wide text-white"

const BAND_LABEL =
  "text-sm font-semibold tracking-[0.15em] text-white/70 uppercase xl:text-base"

// Everything about the round in one band: type, question number, progress,
// answers received (host) and the timer ring.
const QuestionBand = ({
  variant,
  questionType,
  phase,
  time,
  cooldown,
  remaining,
  answered = 0,
  totalPlayers = 0,
}: Props) => {
  const { t } = useTranslation()
  const questionStates = useQuestionStore((state) => state.questionStates)
  const reduceMotion = useReducedMotion()
  const [armed, setArmed] = useState(false)

  // Two frames after mount the ring starts draining toward the next second:
  // the CSS transition then runs from the full ring the screen first painted.
  // The phone announcement waits too, so screen readers hear it.
  useEffect(() => {
    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        setArmed(true)
      })
    })

    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [])

  const isReading = phase === "reading"
  const isSlide = questionType === "slide"
  const hasLimit = time !== NO_TIME_LIMIT
  const seconds = remaining ?? 0
  const ringTotal = isReading ? (cooldown ?? 0) : time
  // The arc reaches each second's value as that second ends. Without motion
  // there is no transition, so it shows the seconds left as they are.
  const shownSeconds = armed && !reduceMotion ? seconds - 1 : seconds
  const fraction = ringTotal > 0 ? shownSeconds / ringTotal : 0
  const answerTone = seconds <= WARNING_SECONDS ? "warning" : "answer"

  const announcement = (() => {
    if (variant === "host" || isSlide || phase === "results") {
      return ""
    }

    if (isReading) {
      return t("game:band.readingLabel", { count: cooldown ?? 0 })
    }

    const threshold =
      hasLimit && remaining !== null
        ? ANNOUNCED_SECONDS.find((limit) => remaining <= limit && limit < time)
        : undefined

    return threshold === undefined
      ? t("game:band.open")
      : t("game:band.timeLeft", { count: threshold })
  })()

  const title = questionStates && (
    <>
      {t("game:prepared.title", { number: questionStates.current })}{" "}
      <span className="font-semibold text-white/60">
        {t("game:prepared.outOf", { total: questionStates.total })}
      </span>
    </>
  )

  const renderTimer = () => {
    // Results: the ring's space stays reserved, so the band keeps the height
    // it had on the answering screen and nothing under it moves.
    if (phase === "results") {
      return variant === "host" ? (
        <span aria-hidden className="size-16 shrink-0 xl:size-20" />
      ) : null
    }

    if (variant === "phone" && isSlide) {
      return null
    }

    if (isReading) {
      return (
        <>
          {variant === "host" && (
            <p className={BAND_LABEL}>{t("game:band.reading")}</p>
          )}
          <TimerRing size={variant} tone="reading" fraction={fraction}>
            <Eye
              aria-hidden
              className={variant === "host" ? "size-6" : "size-4"}
            />
          </TimerRing>
        </>
      )
    }

    if (!hasLimit || remaining === null) {
      return (
        <HintChip
          icon={InfinityIcon}
          className={clsx("shrink-0", {
            "px-2.5 py-0.5 text-xs md:text-xs": variant === "phone",
          })}
        >
          {t("game:band.noLimit")}
        </HintChip>
      )
    }

    return (
      <TimerRing size={variant} tone={answerTone} fraction={fraction}>
        <span
          className={clsx(
            "font-bold tabular-nums",
            variant === "host" ? "text-2xl xl:text-3xl" : "text-sm",
          )}
        >
          {seconds}
        </span>
      </TimerRing>
    )
  }

  if (variant === "phone") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-black/25 px-3 py-2 text-white backdrop-blur-sm">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={clsx(TYPE_CHIP, "px-2.5 py-0.5 text-xs")}>
              {t(`quizz:questionType.${questionType}`)}
            </span>
            {title && <p className="text-sm font-semibold">{title}</p>}
          </div>
          {questionStates && (
            <QuestionProgress
              current={questionStates.current}
              total={questionStates.total}
              variant="phone"
              className="mt-1.5"
            />
          )}
        </div>

        {renderTimer()}

        <p aria-live="polite" className="sr-only">
          {armed ? announcement : ""}
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-8 rounded-2xl bg-black/25 px-6 py-4 text-white backdrop-blur-sm">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={clsx(TYPE_CHIP, "px-4 py-1.5 text-sm md:text-base")}>
            {t(`quizz:questionType.${questionType}`)}
          </span>
          {title && <p className="text-xl font-bold md:text-2xl">{title}</p>}
        </div>
        {questionStates && (
          <QuestionProgress
            current={questionStates.current}
            total={questionStates.total}
            variant="host"
            className="mt-2.5 max-w-xl"
          />
        )}
      </div>

      {/* Nobody answers a slide: no counter. */}
      {!isSlide && (
        <div
          className={clsx("flex shrink-0 flex-col items-end", {
            "opacity-60": isReading,
          })}
        >
          <p aria-hidden className={BAND_LABEL}>
            {t("game:hud.answers")}
          </p>
          <p className="text-3xl font-bold tabular-nums">
            <span className="sr-only">
              {t("game:band.answersLabel", {
                count: answered,
                total: totalPlayers,
              })}
            </span>
            <span aria-hidden>
              {answered}
              <span className="text-xl font-semibold text-white/60">
                {" "}
                / {totalPlayers}
              </span>
            </span>
          </p>
        </div>
      )}

      {/* Fixed width, so the band never shifts between phases. */}
      <div className="flex w-40 shrink-0 items-center justify-end gap-3 xl:w-48">
        {renderTimer()}
      </div>
    </div>
  )
}

export default QuestionBand
