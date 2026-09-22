import { placedItems } from "@razzia/common/utils/ordering"
import ResultVerdict, {
  type Verdict,
} from "@razzia/web/features/manager/components/ResultModal/ResultVerdict"
import PositionBadge from "@razzia/web/features/questions/ordering/components/PositionBadge"
import { orderingScore } from "@razzia/web/features/questions/ordering/utils/records"
import type { ResultCellsProps } from "@razzia/web/features/questions/types"
import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"

// A player's order, each item ticked when at its place, and the share of
// the points it earned.
const OrderingResultCells = ({ question, record }: ResultCellsProps) => {
  const { t, i18n } = useTranslation()
  const { answerIds } = record
  const score = orderingScore(question, record)
  const percent = new Intl.NumberFormat(i18n.language, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(score)

  const verdict = ((): { verdict: Verdict; label: string } => {
    if (answerIds === null) {
      return {
        verdict: "noAnswer",
        label: t("manager:result.verdict.noAnswer"),
      }
    }

    if (score === 1) {
      return { verdict: "correct", label: t("manager:result.verdict.correct") }
    }

    return score > 0
      ? {
          verdict: "partial",
          label: t("manager:result.verdict.partial", { percent }),
        }
      : { verdict: "wrong", label: t("manager:result.verdict.wrong") }
  })()

  const placed =
    answerIds === null ? [] : placedItems(answerIds, question.answers.length)

  return (
    <>
      <td className="px-4 py-2.5">
        {answerIds === null ? (
          <span className="text-muted-foreground text-xs">-</span>
        ) : (
          <ol className="flex flex-wrap gap-1">
            {answerIds.map((id, index) => (
              <li
                key={index}
                className="bg-muted text-foreground inline-flex items-center gap-1.5 rounded-md py-0.5 pr-2 pl-0.5 text-xs"
              >
                <PositionBadge position={index + 1} size="xs" />
                <span className="max-w-30 truncate">
                  {question.answers.at(id) ?? "?"}
                </span>
                {placed[index] && (
                  <Check
                    aria-label={t("manager:result.placed")}
                    className="text-success-strong size-3.5 shrink-0 stroke-3"
                  />
                )}
              </li>
            ))}
          </ol>
        )}
      </td>
      <td className="px-4 py-2.5">
        <ResultVerdict {...verdict} />
      </td>
    </>
  )
}

export default OrderingResultCells
