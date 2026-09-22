import { matchedItems, targetsOf } from "@razzia/common/utils/association"
import AnswerChip from "@razzia/web/features/game/components/AnswerChip"
import ResultVerdict, {
  type Verdict,
} from "@razzia/web/features/manager/components/ResultModal/ResultVerdict"
import { associationScore } from "@razzia/web/features/questions/association/utils/records"
import type { ResultCellsProps } from "@razzia/web/features/questions/types"
import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"

// The target a player picked for each item, ticked when it is the right one,
// and the share of the points the answer earned.
const AssociationResultCells = ({ question, record }: ResultCellsProps) => {
  const { t, i18n } = useTranslation()
  const { answerIds } = record
  const score = associationScore(question, record)
  const percent = new Intl.NumberFormat(i18n.language, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(score)
  const targets = targetsOf(question)

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

  const matched =
    answerIds === null
      ? []
      : matchedItems(answerIds, question.expectedTargets ?? [])

  return (
    <>
      <td className="px-4 py-2.5">
        {answerIds === null ? (
          <span className="text-muted-foreground text-xs">-</span>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {answerIds.map((target, index) => (
              <li
                key={index}
                className="bg-muted text-foreground inline-flex items-center gap-1.5 rounded-md py-0.5 pr-2 pl-0.5 text-xs"
              >
                <AnswerChip index={index} size="sm" />
                <span className="max-w-30 truncate">
                  {targets.at(target) ?? "?"}
                </span>
                {matched[index] && (
                  <Check
                    aria-label={t("manager:result.matchedItem")}
                    className="text-success-strong size-3.5 shrink-0 stroke-3"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-4 py-2.5">
        <ResultVerdict {...verdict} />
      </td>
    </>
  )
}

export default AssociationResultCells
