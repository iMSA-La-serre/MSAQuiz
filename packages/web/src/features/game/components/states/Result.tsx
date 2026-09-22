import type {
  CommonStatusDataMap,
  ResultOutcome,
} from "@razzia/common/types/game/status"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { SFX } from "@razzia/web/features/game/utils/constants"
import { EASE_OUT_QUART, enter } from "@razzia/web/features/game/utils/motion"
import clsx from "clsx"
import {
  type LucideIcon,
  MoveRight,
  TimerOff,
  TrendingDown,
  TrendingUp,
  Vote,
} from "lucide-react"
import { animate, motion, MotionConfig, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"

interface Props {
  data: CommonStatusDataMap["SHOW_RESULT"]
}

// Green for an answer that earned points, fully or partly right (a multi
// partly right is green too); a miss is navy, never red; a poll stays neutral
// because nobody can be wrong.
const TONES: Record<ResultOutcome, string> = {
  correct: "bg-primary",
  partial: "bg-primary",
  wrong: "bg-secondary ring-1 ring-inset ring-white/15",
  noAnswer: "bg-secondary ring-1 ring-inset ring-white/15",
  voted: "bg-black/25 backdrop-blur-sm",
  noVote: "bg-black/25 backdrop-blur-sm",
}

const ICONS: Record<ResultOutcome, LucideIcon> = {
  correct: TrendingUp,
  partial: TrendingUp,
  wrong: MoveRight,
  noAnswer: TimerOff,
  voted: Vote,
  noVote: TimerOff,
}

// Outcomes that earned points: they count up and sound like a right answer.
const CREDITED: ResultOutcome[] = ["correct", "partial"]

// One sound per outcome, so a single sound loads and plays once. A poll has no
// right answer, so it gets the neutral chime. Read at render time: the
// constants module imports this screen, so SFX is not ready at load time.
const resultSound = (outcome: ResultOutcome): string => {
  if (CREDITED.includes(outcome)) {
    return SFX.RESULT.CORRECT
  }

  if (outcome === "voted" || outcome === "noVote") {
    return SFX.SHOW_SOUND
  }

  return SFX.RESULT.INCORRECT
}

const COUNT_DURATION = 0.6

const TOTAL_DELAY = 0.3

// The player band's total changes when the card's count-up lands.
const BAND_SYNC_MS = 900

const Result = ({
  data: { outcome, message, points, myPoints, rank, totalPlayers, placed },
}: Props) => {
  const updatePoints = usePlayerStore((state) => state.updatePoints)
  const { t, i18n } = useTranslation()
  const reduceMotion = useReducedMotion()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const isCredited = CREDITED.includes(outcome)
  const isCounting = isCredited && !reduceMotion
  const [countedPoints, setCountedPoints] = useState(0)
  const [countedTotal, setCountedTotal] = useState(myPoints - points)
  const [sfxResult] = useSound(resultSound(outcome), { volume: 0.2 })

  const isMiss = outcome === "wrong" || outcome === "noAnswer"
  const showPoints = isCredited || (isMiss && points < 0)
  const Icon = outcome === "wrong" && points < 0 ? TrendingDown : ICONS[outcome]
  const signedFormat = new Intl.NumberFormat(i18n.language, {
    signDisplay: "always",
  })
  const numberFormat = new Intl.NumberFormat(i18n.language)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  // `sfxResult` is a no-op until the sound has loaded, then gets a new
  // identity: the sound therefore plays exactly once, as soon as it can.
  useEffect(() => {
    sfxResult()
  }, [sfxResult])

  useEffect(() => {
    if (!isCounting) {
      return
    }

    const pointsCount = animate(0, points, {
      duration: COUNT_DURATION,
      ease: EASE_OUT_QUART,
      onUpdate: (value) => {
        setCountedPoints(Math.round(value))
      },
    })
    const totalCount = animate(myPoints - points, myPoints, {
      duration: COUNT_DURATION,
      delay: TOTAL_DELAY,
      ease: EASE_OUT_QUART,
      onUpdate: (value) => {
        setCountedTotal(Math.round(value))
      },
    })

    return () => {
      pointsCount.stop()
      totalCount.stop()
    }
  }, [isCounting, points, myPoints])

  useEffect(() => {
    const timer = setTimeout(
      () => {
        updatePoints(myPoints)
      },
      reduceMotion ? 0 : BAND_SYNC_MS,
    )

    return () => {
      clearTimeout(timer)
      updatePoints(myPoints)
    }
  }, [myPoints, reduceMotion, updatePoints])

  return (
    <MotionConfig reducedMotion="user">
      <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 px-4 py-6">
        <motion.div
          {...enter()}
          className={clsx(
            "relative overflow-hidden rounded-2xl p-6 text-white shadow-2xl",
            TONES[outcome],
          )}
        >
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15"
            >
              <Icon className="size-8" />
            </span>
            {/* Focused on mount so screen readers announce it. It is not a
            control and cannot be tabbed to, so it draws no focus box: the
            browser would otherwise frame it after an Enter key press. */}
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-3xl font-bold text-balance outline-none"
            >
              {t(message)}
            </h2>
          </div>

          {/* Solid white only: white/80 on the green card fails even for
          large text. */}
          {showPoints && (
            <p className="mt-5 text-5xl font-bold tabular-nums">
              {signedFormat.format(isCounting ? countedPoints : points)}
              <span className="ml-1 text-2xl font-semibold">
                {t("game:finale.points")}
              </span>
            </p>
          )}
          {placed && (
            <p className="mt-2 text-lg leading-snug font-semibold text-balance">
              {t("game:result.placed", {
                count: placed.count,
                total: placed.total,
              })}
            </p>
          )}
        </motion.div>

        <motion.dl
          {...enter(0.12)}
          className="grid grid-cols-2 gap-2 text-white"
        >
          <div className="rounded-xl bg-black/25 px-4 py-3 backdrop-blur-sm">
            <dt className="text-sm font-semibold tracking-[0.15em] text-white/80 uppercase">
              {t("game:result.total")}
            </dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">
              {numberFormat.format(isCounting ? countedTotal : myPoints)}
              <span className="ml-1 text-base font-semibold text-white/75">
                {t("game:finale.points")}
              </span>
            </dd>
          </div>
          <div className="rounded-xl bg-black/25 px-4 py-3 backdrop-blur-sm">
            <dt className="text-sm font-semibold tracking-[0.15em] text-white/80 uppercase">
              {t("game:result.rankLabel")}
            </dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">
              {rank}
              <span className="ml-1.5 text-lg font-semibold text-white/70">
                {t("game:result.outOf", { total: totalPlayers })}
              </span>
            </dd>
          </div>
        </motion.dl>
      </section>
    </MotionConfig>
  )
}

export default Result
