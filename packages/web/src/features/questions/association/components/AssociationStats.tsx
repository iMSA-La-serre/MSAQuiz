import { answerLetter } from "@razzia/web/features/game/utils/constants"
import { formatRate, rateColor } from "@razzia/web/features/manager/utils/stats"
import type { StatsAnswersProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { useTranslation } from "react-i18next"

// Every item with its right target, and the share of players who matched it,
// coloured like a success rate, as an ordering's items. Above, the answers
// with every item matched, and the mean score.
const AssociationStats = ({ question }: StatsAnswersProps) => {
  const { t } = useTranslation()
  const rateOf = (count: number) =>
    question.answerCount === 0 ? null : count / question.answerCount

  return (
    <>
      <p className="text-muted-foreground mt-2 text-xs">
        {t("manager:stats.flawless", { count: question.correctCount })} ·{" "}
        {t("manager:stats.averageScore", {
          rate: formatRate(question.averageScore ?? null),
        })}
      </p>

      <p className="text-muted-foreground mt-2 text-xs font-semibold">
        {t("manager:stats.matchedByItem")}
      </p>
      <ul className="mt-1 space-y-1">
        {question.answers.map((answer, index) => {
          const rate = rateOf(answer.count)
          const target = question.solutionLabels.at(index)

          return (
            <li key={index} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground flex min-w-0 flex-1 items-center gap-1 truncate">
                <span className="font-semibold">{answerLetter(index)}.</span>
                {answer.label}
                {target && (
                  <span className="text-foreground font-semibold">
                    {" "}
                    · {target}
                  </span>
                )}
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
      </ul>
    </>
  )
}

export default AssociationStats
