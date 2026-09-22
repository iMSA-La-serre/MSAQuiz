import { formatRate, rateColor } from "@razzia/web/features/manager/utils/stats"
import type { StatsAnswersProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { useTranslation } from "react-i18next"

// The correct order, each item with the share of players who put it at its
// place, coloured like a success rate.
const OrderingStats = ({ question }: StatsAnswersProps) => {
  const { t } = useTranslation()
  const rateOf = (count: number) =>
    question.answerCount === 0 ? null : count / question.answerCount

  return (
    <>
      <p className="text-muted-foreground mt-2 text-xs">
        {t("manager:stats.exactOrders", { count: question.correctCount })} ·{" "}
        {t("manager:stats.averageScore", {
          rate: formatRate(question.averageScore ?? null),
        })}
      </p>

      <p className="text-muted-foreground mt-2 text-xs font-semibold">
        {t("manager:stats.placedByItem")}
      </p>
      <ol className="mt-1 space-y-1">
        {question.answers.map((answer, index) => {
          const rate = rateOf(answer.count)

          return (
            <li key={index} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground flex min-w-0 flex-1 items-center gap-1 truncate">
                <span className="font-semibold tabular-nums">{index + 1}.</span>
                {answer.label}
              </span>
              <span className="bg-muted h-1.5 w-24 shrink-0 overflow-hidden rounded-full">
                <span
                  className={clsx("block h-full rounded-full", rateColor(rate))}
                  style={{ width: `${(rate ?? 0) * 100}%` }}
                />
              </span>
              <span className="text-muted-foreground w-10 shrink-0 text-right tabular-nums">
                {formatRate(rate)}
              </span>
            </li>
          )
        })}
      </ol>
    </>
  )
}

export default OrderingStats
