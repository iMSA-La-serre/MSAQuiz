import AnswerChip from "@razzia/web/features/game/components/AnswerChip"
import type { ResultSummaryProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { Check, X } from "lucide-react"
import { useTranslation } from "react-i18next"

interface AnswerRow {
  label: string
  count: number
  isCorrect: boolean
  // Answer position, null for the "no answer" row.
  index: number | null
}

// The answers block of the choice types in the result window: each answer
// with its letter, whether it is right, and the players who picked it.
const ChoiceSummary = ({ question, noAnswerCount }: ResultSummaryProps) => {
  const { t } = useTranslation()

  const rows: AnswerRow[] = [
    ...question.answers.map((label, ai) => ({
      label,
      count: question.playerAnswers.filter((pa) => pa.answerIds?.includes(ai))
        .length,
      isCorrect: question.solutions.includes(ai),
      index: ai,
    })),
    {
      label: t("manager:result.noAnswer"),
      count: noAnswerCount,
      isCorrect: false,
      index: null,
    },
  ]

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1.5 md:gap-y-2">
      {rows.map((row, i) => (
        <div key={i} className="contents">
          {row.index !== null ? (
            <AnswerChip index={row.index} size="sm" />
          ) : (
            <div className="border-accent flex size-6 shrink-0 items-center justify-center rounded-md border-2 bg-white">
              <X className="text-muted-foreground size-3 stroke-4" />
            </div>
          )}

          <span
            className={clsx("min-w-0 truncate text-sm font-medium", {
              "text-muted-foreground": row.index === null,
            })}
          >
            {row.label}
          </span>

          <div className="shrink-0">
            {row.isCorrect ? (
              <Check className="text-success size-5 stroke-4" />
            ) : (
              <X
                className={clsx(
                  "size-5 stroke-4",
                  row.index === null ? "text-danger-soft" : "text-danger",
                )}
              />
            )}
          </div>

          <span className="text-accent-foreground text-center text-sm font-semibold">
            {row.count}
          </span>
        </div>
      ))}
    </div>
  )
}

export default ChoiceSummary
