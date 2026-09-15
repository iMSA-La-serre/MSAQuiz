import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import { Sprout } from "lucide-react"
import { AnimatePresence, motion, useSpring, useTransform } from "motion/react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  data: ManagerStatusDataMap["SHOW_LEADERBOARD"]
}

const AnimatedPoints = ({ from, to }: { from: number; to: number }) => {
  const spring = useSpring(from, { stiffness: 1000, damping: 30 })
  const display = useTransform(spring, (value) => Math.round(value))
  const [displayValue, setDisplayValue] = useState(from)

  useEffect(() => {
    spring.set(to)
    const unsubscribe = display.on("change", (latest) => {
      setDisplayValue(latest)
    })

    return unsubscribe
  }, [to, spring, display])

  return <span className="drop-shadow-md">{displayValue}</span>
}

// From three correct answers in a row, a small "sprout" chip grows next to the
// name with the count, in the La Serre spirit of things that grow.
const MIN_RUN = 3

const RunBadge = ({ count }: { count: number }) => {
  const { t } = useTranslation()

  return (
    <AnimatePresence>
      {count >= MIN_RUN && (
        <motion.span
          key="run"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          aria-label={t("game:correctInARow", { count })}
          title={t("game:correctInARow", { count })}
          className="ml-2 flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xl font-bold tabular-nums"
        >
          <Sprout aria-hidden className="size-5" />
          <span aria-hidden>×{count}</span>
        </motion.span>
      )}
    </AnimatePresence>
  )
}

const Leaderboard = ({ data: { oldLeaderboard, leaderboard } }: Props) => {
  const [displayedLeaderboard, setDisplayedLeaderboard] =
    useState(oldLeaderboard)
  const [isAnimating, setIsAnimating] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    setDisplayedLeaderboard(oldLeaderboard)
    setIsAnimating(false)

    const timer = setTimeout(() => {
      setIsAnimating(true)
      setDisplayedLeaderboard(leaderboard)
    }, 1600)

    return () => {
      clearTimeout(timer)
    }
  }, [oldLeaderboard, leaderboard])

  return (
    <section className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-2">
      <h2 className="mb-6 text-5xl font-bold text-white drop-shadow-md">
        {t("game:leaderboard")}
      </h2>
      <div className="flex w-full flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {displayedLeaderboard.map(
            ({ id, username, points, correctInARow }) => (
              <motion.div
                key={id}
                layout
                initial={{ opacity: 0, y: 50 }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: 50,
                  transition: { duration: 0.2 },
                }}
                transition={{
                  layout: {
                    type: "spring",
                    stiffness: 350,
                    damping: 25,
                  },
                }}
                className="bg-primary flex w-full justify-between rounded-xl p-3 text-3xl font-bold text-white"
              >
                <span className="flex items-center gap-2 drop-shadow-md">
                  {username}
                  <RunBadge count={correctInARow} />
                </span>
                {isAnimating ? (
                  <AnimatedPoints
                    from={oldLeaderboard.find((u) => u.id === id)?.points ?? 0}
                    to={leaderboard.find((u) => u.id === id)?.points ?? 0}
                  />
                ) : (
                  <span className="drop-shadow-md">{points}</span>
                )}
              </motion.div>
            ),
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}

export default Leaderboard
