import { rankByCount } from "@razzia/web/features/questions/shortanswer/utils/records"
import type { StatsAnswersProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { Check, X } from "lucide-react"
import { useTranslation } from "react-i18next"

// The accepted answers by number of inputs they recognized, then the inputs
// that matched none, counted only.
const ShortAnswerStats = ({ question }: StatsAnswersProps) => {
  const { t } = useTranslation()
  const share = (count: number) =>
    question.answerCount === 0 ? 0 : (count / question.answerCount) * 100
  const rows = [
    ...rankByCount(question.answers.map(({ count }) => count)).map((index) => ({
      ...question.answers[index],
      recognized: true,
    })),
    {
      label: t("manager:stats.unrecognized"),
      count: question.unrecognizedCount ?? 0,
      recognized: false,
    },
  ]

  return (
    <ul className="mt-2 space-y-1">
      {rows.map(({ label, count, recognized }, index) => (
        <li key={index} className="flex items-center gap-2 text-xs">
          <span
            className={clsx(
              "flex min-w-0 flex-1 items-center gap-1 truncate",
              recognized ? "text-success-strong" : "text-muted-foreground",
            )}
          >
            {recognized ? (
              <Check aria-hidden className="size-3 shrink-0" />
            ) : (
              <X aria-hidden className="size-3 shrink-0" />
            )}
            {label}
          </span>
          <span className="bg-muted h-1.5 w-24 shrink-0 overflow-hidden rounded-full">
            <span
              className={clsx(
                "block h-full rounded-full",
                recognized ? "bg-success" : "bg-neutral-mark",
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
  )
}

export default ShortAnswerStats
