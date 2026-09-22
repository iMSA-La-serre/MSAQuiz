import AnswerRow, {
  isCompactList,
} from "@razzia/web/features/game/components/question/AnswerRow"
import HintChip from "@razzia/web/features/game/components/question/HintChip"
import {
  BAR_DURATION,
  EASE_OUT_QUART,
  fadeIn,
  REVEAL_DELAY,
  staggerDelay,
} from "@razzia/web/features/game/utils/motion"
import { shareOf } from "@razzia/web/features/game/utils/score"
import type { LucideIcon } from "lucide-react"
import clsx from "clsx"
import { motion, useReducedMotion } from "motion/react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

interface ResponseRowProps {
  // Place in the list: the stagger of the bar, and the letter chip unless a
  // marker takes its place.
  index: number
  text: ReactNode
  count: number
  // Players who answered: the base of the share.
  total: number
  // Accessible name of the row, from the figures it shows.
  label: (_figures: { count: number; total: number; percent: string }) => string
  // A right answer: labelled « Bonne réponse », outlined once revealed.
  correct?: boolean
  revealed: boolean
  dense?: boolean
  // The compact answering rows of a long list (isCompactList), with a thinner
  // bar and smaller figures. No « Bonne réponse » label: it would cover the
  // row above.
  compact?: boolean
  // A compact row that keeps its « Bonne réponse » label: the one right row
  // of a long list (estimate). The label gets room above the row, and the
  // row's content moves down under it, clear of the figures.
  labelled?: boolean
  marker?: ReactNode
}

// One row of the host distribution: the answering row, with a neutral bar,
// its count and its share of respondents.
const ResponseRow = ({
  index,
  text,
  count,
  total,
  label,
  correct = false,
  revealed,
  dense = false,
  compact = false,
  labelled = false,
  marker,
}: ResponseRowProps) => {
  const { t, i18n } = useTranslation()
  const reduceMotion = useReducedMotion()
  const share = shareOf(count, total)
  const percent = new Intl.NumberFormat(i18n.language, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(share)
  const delay = staggerDelay(index, REVEAL_DELAY)
  const rowLabel = label({ count, total, percent })
  const labelledRow = correct && compact && labelled

  // On the row's top edge, out of the flow: inline after the text, the label
  // wraps to a second line in the narrow image column and every row moves.
  const correctLabel = correct && (!compact || labelled) && (
    <motion.span
      {...fadeIn(REVEAL_DELAY, reduceMotion)}
      className="bg-serre-deep pointer-events-none absolute -top-2.5 right-5 rounded-full px-3 py-0.5 text-sm leading-4 font-bold tracking-[0.15em] whitespace-nowrap text-white uppercase xl:-top-3.5 xl:right-6 xl:py-1 xl:text-base xl:leading-5"
    >
      {t("game:responses.correct")}
    </motion.span>
  )

  // The same neutral tint on every row, the correct one included.
  const bar = (
    <span
      aria-hidden
      className={clsx(
        "bg-secondary/10 block overflow-hidden rounded-full",
        compact ? "mt-1 h-2.5" : "mt-2 h-3 xl:h-4",
      )}
    >
      <motion.span
        initial={reduceMotion ? false : { width: "0%" }}
        animate={{ width: `${share * 100}%` }}
        transition={{ duration: BAR_DURATION, delay, ease: EASE_OUT_QUART }}
        className="bg-secondary/70 block h-full rounded-full"
      />
    </span>
  )

  // A minimum width keeps every bar track the same length.
  const numbers = (
    <motion.span
      {...fadeIn(delay, reduceMotion)}
      className="flex min-w-40 shrink-0 items-baseline justify-end gap-3 tabular-nums xl:min-w-48"
    >
      <span
        className={clsx(
          "text-3xl font-bold",
          compact ? "leading-none" : "xl:text-4xl",
        )}
      >
        {new Intl.NumberFormat(i18n.language).format(count)}
      </span>
      <span
        className={clsx(
          "text-secondary/75 text-xl font-semibold",
          !compact && "xl:text-2xl",
        )}
      >
        {percent}
      </span>
    </motion.span>
  )

  return (
    <li
      aria-label={
        correct ? `${rowLabel}, ${t("game:responses.correct")}` : rowLabel
      }
      // As much room below as above, where the label hangs.
      className={labelledRow ? "my-1 xl:my-2" : undefined}
    >
      <AnswerRow
        index={index}
        text={text}
        size="host"
        dense={dense}
        compact={compact}
        // The label's depth into the row; `short:` as the row's own padding.
        className={labelledRow ? "short:pt-3 pt-3" : undefined}
        outlined={correct && revealed}
        marker={marker}
        footer={bar}
        trailing={
          <>
            {correctLabel}
            {numbers}
          </>
        }
      />
    </li>
  )
}

interface ResponseFrameProps {
  hint?: { icon: LucideIcon; text: string }
  // On the hint's line, at the other end: controls of the distribution.
  actions?: ReactNode
  // Noted under the content, at the other end from the missing answers:
  // what the content leaves out.
  aside?: ReactNode
  // Players of the game with no answer, noted under the content.
  unanswered: number
  children: ReactNode
}

// Where the answering screen put its hint and rows: the hint, then the
// distribution, with the count of missing answers under it.
export const ResponseFrame = ({
  hint,
  actions,
  aside,
  unanswered,
  children,
}: ResponseFrameProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4">
      {(hint ?? actions) && (
        <div
          className={
            actions ? "flex items-center justify-between gap-4" : "self-start"
          }
        >
          {hint && <HintChip icon={hint.icon}>{hint.text}</HintChip>}
          {actions}
        </div>
      )}
      {/* The count of missing answers hangs under the content, out of the
      flow, so the centred rows stay where the answering screen put them. */}
      <div className="relative">
        {children}
        {aside && (
          <p className="absolute top-full left-0 mt-4 text-xl whitespace-nowrap text-white/80 xl:text-2xl">
            {aside}
          </p>
        )}
        {unanswered > 0 && (
          <p className="absolute top-full right-0 mt-4 text-right text-xl whitespace-nowrap text-white/80 xl:text-2xl">
            {t("game:responses.noAnswer", { count: unanswered })}
          </p>
        )}
      </div>
    </div>
  )
}

interface ResponseListProps {
  hint?: { icon: LucideIcon; text: string }
  // Players of the game with no answer, noted under the list.
  unanswered: number
  // Name of the list, « Répartition des réponses » by default.
  label?: string
  // Rows in the list: past four, they are compact and closer together.
  rows: number
  children: ReactNode
}

// The hint and the rows of the host distribution, where the answering screen
// put its hint and rows.
export const ResponseList = ({
  hint,
  unanswered,
  label,
  rows,
  children,
}: ResponseListProps) => {
  const { t } = useTranslation()

  return (
    <ResponseFrame hint={hint} unanswered={unanswered}>
      <ol
        aria-label={label ?? t("game:responses.label")}
        className={clsx(
          "flex flex-col",
          isCompactList(rows) ? "gap-2" : "short:gap-2 gap-3 xl:gap-4",
        )}
      >
        {children}
      </ol>
    </ResponseFrame>
  )
}

export default ResponseRow
