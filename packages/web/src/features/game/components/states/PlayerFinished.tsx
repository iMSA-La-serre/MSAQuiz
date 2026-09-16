import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import Points from "@razzia/web/features/game/components/ranking/Points"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { enter } from "@razzia/web/features/game/utils/motion"
import clsx from "clsx"
import { motion, MotionConfig } from "motion/react"
import { useTranslation } from "react-i18next"

interface Props {
  data: CommonStatusDataMap["FINISHED"]
}

const PlayerFinished = ({ data: { subject, rank, totalPlayers } }: Props) => {
  const { player } = usePlayerStore()
  const { t } = useTranslation()

  return (
    <MotionConfig reducedMotion="user">
      <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-6 text-center text-white">
        <motion.header {...enter()}>
          <p className="text-sm font-semibold tracking-[0.2em] text-white/70 uppercase">
            {t("game:finale.eyebrow")}
          </p>
          <h2 className="mt-2 text-3xl font-bold text-balance drop-shadow-lg">
            {subject}
          </h2>
        </motion.header>

        <motion.div
          {...enter(0.1)}
          className={clsx("rounded-2xl bg-black/25 p-6 backdrop-blur-sm", {
            "ring-primary ring-2": rank === 1,
          })}
        >
          <dl>
            <dt className="text-sm font-semibold tracking-[0.15em] text-white/80 uppercase">
              {t("game:result.rankLabel")}
            </dt>
            <dd className="mt-1 text-5xl font-bold tabular-nums">
              {rank ?? "—"}
              {rank !== undefined && totalPlayers !== undefined && (
                <span className="ml-2 text-2xl font-semibold text-white/70">
                  {t("game:result.outOf", { total: totalPlayers })}
                </span>
              )}
            </dd>
          </dl>
          <Points
            value={player?.points ?? 0}
            large
            className="mt-3 justify-center"
          />
        </motion.div>
      </section>
    </MotionConfig>
  )
}

export default PlayerFinished
