import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import Points from "@razzia/web/features/game/components/ranking/Points"
import RankChip from "@razzia/web/features/game/components/ranking/RankChip"
import { SFX } from "@razzia/web/features/game/utils/constants"
import { motion, MotionConfig, useReducedMotion } from "motion/react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"

interface Props {
  data: ManagerStatusDataMap["FINISHED"]
}

const FinalRanking = ({ data: { subject, top } }: Props) => {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const [winner, ...others] = top
  const [playFinale] = useSound(SFX.FINALE, { volume: 0.3 })

  // `playFinale` is a no-op until the sound has loaded, then gets a new
  // identity: the chord therefore plays exactly once, as soon as it can.
  useEffect(() => {
    playFinale()
  }, [playFinale])

  return (
    <MotionConfig reducedMotion="user">
      <section className="short:gap-4 short:pb-4 relative mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-6 px-4 pb-10">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="text-center"
        >
          <p className="text-sm font-semibold tracking-[0.2em] text-white/70 uppercase md:text-base">
            {t("game:finale.eyebrow")}
          </p>
          <h2 className="mt-2 text-3xl font-bold text-balance text-white drop-shadow-lg md:text-5xl">
            {subject}
          </h2>
        </motion.header>

        {top.length > 0 ? (
          <>
            {/* On small screens the score drops under the name, so the
            winner's name keeps the full width of the card. */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}
              className="bg-primary relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1 overflow-hidden rounded-2xl p-5 text-white shadow-2xl md:flex md:gap-6 md:p-7"
            >
              {!reduceMotion && (
                <motion.span
                  aria-hidden
                  initial={{ x: "-100%" }}
                  animate={{ x: "400%" }}
                  transition={{ duration: 1.1, delay: 0.45, ease: "easeInOut" }}
                  className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-white/25 to-transparent"
                />
              )}
              <RankChip rank={1} large />
              <div className="min-w-0 flex-1">
                {/* Solid white at 20 px bold: smaller or translucent text
                fails on the green card. */}
                <p className="text-xl font-bold tracking-[0.15em] text-white uppercase">
                  {t("game:finale.winner")}
                </p>
                <p className="truncate text-3xl font-bold md:text-5xl">
                  {winner.username}
                </p>
              </div>
              <Points
                value={winner.points}
                large
                className="col-start-2 md:col-auto"
                unitClassName="text-xl font-bold text-white md:text-2xl md:font-semibold"
              />
            </motion.div>

            {others.length > 0 && (
              <ol className="flex flex-col gap-2">
                {others.map((player, index) => (
                  <motion.li
                    key={player.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.35,
                      delay: 0.25 + index * 0.07,
                      ease: "easeOut",
                    }}
                    className="flex items-center gap-4 rounded-xl bg-black/25 px-4 py-3 text-white backdrop-blur-sm"
                  >
                    <RankChip rank={index + 2} />
                    <p className="min-w-0 flex-1 truncate text-xl font-semibold md:text-2xl">
                      {player.username}
                    </p>
                    <Points value={player.points} />
                  </motion.li>
                ))}
              </ol>
            )}
          </>
        ) : (
          <p className="text-center text-2xl font-semibold text-white/80">
            {t("game:finale.noPlayers")}
          </p>
        )}
      </section>
    </MotionConfig>
  )
}

export default FinalRanking
