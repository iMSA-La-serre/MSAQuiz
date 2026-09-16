import { Sprout } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslation } from "react-i18next"

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

export default RunBadge
