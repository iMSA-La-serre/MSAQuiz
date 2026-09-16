import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import Points from "@razzia/web/features/game/components/ranking/Points"
import RankChip from "@razzia/web/features/game/components/ranking/RankChip"
import RunBadge from "@razzia/web/features/game/components/ranking/RunBadge"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import { enter, staggerDelay } from "@razzia/web/features/game/utils/motion"
import clsx from "clsx"
import { motion, MotionConfig } from "motion/react"
import { useTranslation } from "react-i18next"

interface Props {
  data: ManagerStatusDataMap["SHOW_LEADERBOARD"]
}

const ROW_DELAY_BASE = 0.15

const GAIN_DELAY = 0.15

// The new ranking shows at once: rows fade in one after the other, with the
// points each player just gained. Nothing moves between positions.
const Leaderboard = ({ data: { leaderboard } }: Props) => {
  const { t, i18n } = useTranslation()
  const { questionStates } = useQuestionStore()
  // After a poll or a slide nobody gained anything: no gain pills at all.
  const showGains = leaderboard.some((player) => player.gain !== 0)
  const gainFormat = new Intl.NumberFormat(i18n.language, {
    signDisplay: "always",
  })

  return (
    <MotionConfig reducedMotion="user">
      <section className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-6 px-4">
        <motion.header {...enter()} className="text-center">
          {questionStates && (
            <p className="text-sm font-semibold tracking-[0.2em] text-white/70 uppercase md:text-base">
              {t("game:leaderboardAfter", {
                number: questionStates.current,
                total: questionStates.total,
              })}
            </p>
          )}
          <h2 className="mt-2 text-3xl font-bold text-balance text-white drop-shadow-lg md:text-5xl">
            {t("game:leaderboard")}
          </h2>
        </motion.header>

        <ol className="flex flex-col gap-2 md:gap-3">
          {leaderboard.map(
            ({ id, username, points, correctInARow, gain }, index) => {
              const rowDelay = staggerDelay(index, ROW_DELAY_BASE)

              return (
                <motion.li
                  key={id}
                  {...enter(rowDelay)}
                  className="flex items-center gap-4 rounded-xl bg-black/25 px-4 py-3 text-white backdrop-blur-sm md:px-5 md:py-4"
                >
                  <RankChip
                    rank={index + 1}
                    className={clsx("md:size-12 md:text-2xl", {
                      "bg-primary": index === 0,
                    })}
                  />
                  <p className="flex min-w-0 flex-1 items-center gap-2 text-xl font-semibold md:text-3xl">
                    <span className="truncate">{username}</span>
                    <RunBadge count={correctInARow} />
                  </p>
                  {showGains && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{
                        duration: 0.2,
                        delay: rowDelay + GAIN_DELAY,
                      }}
                      className={clsx(
                        "shrink-0 rounded-full bg-white/10 px-3 py-1 text-lg font-bold tabular-nums md:text-2xl",
                        {
                          "text-white": gain > 0,
                          "text-white/80": gain < 0,
                          "text-white/60": gain === 0,
                        },
                      )}
                    >
                      {gainFormat.format(gain)}
                    </motion.span>
                  )}
                  <Points
                    value={points}
                    className="min-w-32 text-right md:text-3xl"
                  />
                </motion.li>
              )
            },
          )}
        </ol>
      </section>
    </MotionConfig>
  )
}

export default Leaderboard
