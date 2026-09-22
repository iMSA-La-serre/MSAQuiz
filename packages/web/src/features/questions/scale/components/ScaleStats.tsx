import { formatLevel } from "@razzia/web/features/questions/scale/utils/format"
import type { StatsAnswersProps } from "@razzia/web/features/questions/types"
import { useTranslation } from "react-i18next"

// The mean and the median of the levels picked across the games, then the
// players of each level, the lowest first, with what each end stands for.
const ScaleStats = ({ question }: StatsAnswersProps) => {
  const { t, i18n } = useTranslation()
  const { scale } = question

  if (!scale) {
    return null
  }

  const total = question.answers.reduce((sum, { count }) => sum + count, 0)
  const share = (count: number) =>
    total === 0 ? 0 : Math.min(100, (count / total) * 100)
  const endOf = (index: number) => {
    if (index === 0 && scale.low !== undefined) {
      return scale.low
    }

    return index === question.answers.length - 1 && scale.high !== undefined
      ? scale.high
      : ""
  }

  if (scale.withheld === true && total === 0) {
    return (
      <p className="text-muted-foreground mt-2 text-xs">
        {t("manager:stats.scaleWithheld")}
      </p>
    )
  }

  return (
    <>
      <p className="text-muted-foreground mt-2 text-xs">
        {scale.mean === null || scale.median === null
          ? t("manager:stats.scaleEmpty")
          : t("manager:stats.scaleSummary", {
              mean: formatLevel(scale.mean, i18n.language),
              median: formatLevel(scale.median, i18n.language),
            })}
        {" · "}
        {t("manager:stats.scaleSkipped", { count: scale.skipped })}
      </p>

      <ul className="mt-2 space-y-1">
        {question.answers.map(({ label, count }, index) => {
          const end = endOf(index)

          return (
            <li key={label} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground flex min-w-0 flex-1 items-center gap-1 truncate">
                <span className="text-foreground font-semibold tabular-nums">
                  {label}
                </span>
                {end}
              </span>
              <span className="bg-muted h-1.5 w-24 shrink-0 overflow-hidden rounded-full">
                <span
                  className="bg-neutral-mark block h-full rounded-full"
                  style={{ width: `${share(count)}%` }}
                />
              </span>
              <span className="text-muted-foreground w-8 shrink-0 text-right tabular-nums">
                {count}
              </span>
            </li>
          )
        })}
      </ul>
    </>
  )
}

export default ScaleStats
