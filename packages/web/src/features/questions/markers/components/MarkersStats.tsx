import type { StatsAnswersProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { Check } from "lucide-react"

// Every marker, numbered as on the image, with the players who tapped it;
// the right ones in green, as a choice's right answers.
const MarkersStats = ({ question }: StatsAnswersProps) => {
  const share = (count: number) =>
    question.answerCount === 0 ? 0 : (count / question.answerCount) * 100

  return (
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
              <span className="font-semibold tabular-nums">{index + 1}.</span>
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
  )
}

export default MarkersStats
