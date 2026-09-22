import { answerLetter } from "@razzia/web/features/game/utils/constants"
import { formatRate } from "@razzia/web/features/manager/utils/stats"
import type { StatsAnswersProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"

// Every passage, lettered in the order of the text, with the players who
// tapped it; the ones to spot in green, as a multiple choice's right answers.
// Above, the answers with every passage to spot and no other, and the mean
// score.
const HighlightStats = ({ question }: StatsAnswersProps) => {
  const { t } = useTranslation()
  const share = (count: number) =>
    question.answerCount === 0 ? 0 : (count / question.answerCount) * 100

  return (
    <>
      <p className="text-muted-foreground mt-2 text-xs">
        {t("manager:stats.flawless", { count: question.correctCount })} ·{" "}
        {t("manager:stats.averageScore", {
          rate: formatRate(question.averageScore ?? null),
        })}
      </p>

      <ul className="mt-2 space-y-1">
        {question.answers.map((answer, index) => {
          const isSolution = question.solutionLabels.includes(answer.label)

          return (
            <li key={index} className="flex items-center gap-2 text-xs">
              <span
                className={clsx(
                  "flex min-w-0 flex-1 items-center gap-1 truncate",
                  isSolution ? "text-success-strong" : "text-muted-foreground",
                )}
              >
                {isSolution && <Check className="size-3 shrink-0" />}
                <span className="font-semibold">{answerLetter(index)}.</span>
                {answer.label}
              </span>
              <span className="bg-muted h-1.5 w-24 shrink-0 overflow-hidden rounded-full">
                <span
                  className={clsx(
                    "block h-full rounded-full",
                    isSolution ? "bg-success" : "bg-neutral-mark",
                  )}
                  style={{ width: `${share(answer.count)}%` }}
                />
              </span>
              <span className="text-muted-foreground w-8 shrink-0 text-right">
                {answer.count}
              </span>
            </li>
          )
        })}
      </ul>
    </>
  )
}

export default HighlightStats
