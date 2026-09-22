import type { StatsAnswersProps } from "@razzia/web/features/questions/types"
import { summaryText } from "@razzia/web/features/questions/estimate/utils/format"
import clsx from "clsx"
import { Check, ChevronDown, ChevronUp, type LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

// The right value and the median of the numbers sent across the games, then
// the answers within, below and above the tolerance of their game.
const EstimateStats = ({ question }: StatsAnswersProps) => {
  const { t } = useTranslation()
  const { estimate } = question

  if (!estimate) {
    return null
  }

  const share = (count: number) =>
    question.answerCount === 0 ? 0 : (count / question.answerCount) * 100
  const summary = summaryText(t, estimate, {
    expected: "manager:stats.estimateExpected",
    summary: "manager:stats.estimateSummary",
  })
  const rows: Array<{
    label: string
    count: number
    icon: LucideIcon
    right: boolean
  }> = [
    {
      label: t("manager:stats.estimateWithin"),
      count: estimate.within,
      icon: Check,
      right: true,
    },
    {
      label: t("manager:stats.estimateBelow"),
      count: estimate.below,
      icon: ChevronDown,
      right: false,
    },
    {
      label: t("manager:stats.estimateAbove"),
      count: estimate.above,
      icon: ChevronUp,
      right: false,
    },
  ]

  return (
    <>
      {summary !== null && (
        <p className="text-muted-foreground mt-2 text-xs">{summary}</p>
      )}
      <ul className="mt-2 space-y-1">
        {rows.map(({ label, count, icon: Icon, right }) => (
          <li key={label} className="flex items-center gap-2 text-xs">
            <span
              className={clsx(
                "flex min-w-0 flex-1 items-center gap-1 truncate",
                right ? "text-success-strong" : "text-muted-foreground",
              )}
            >
              <Icon aria-hidden className="size-3 shrink-0" />
              {label}
            </span>
            <span className="bg-muted h-1.5 w-24 shrink-0 overflow-hidden rounded-full">
              <span
                className={clsx(
                  "block h-full rounded-full",
                  right ? "bg-success" : "bg-neutral-mark",
                )}
                style={{ width: `${share(count)}%` }}
              />
            </span>
            <span className="text-muted-foreground w-8 shrink-0 text-right">
              {count}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

export default EstimateStats
