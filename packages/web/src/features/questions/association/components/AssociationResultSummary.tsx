import { rightTargetOf } from "@razzia/common/utils/association"
import AnswerChip from "@razzia/web/features/game/components/AnswerChip"
import ResultSummaryRow, {
  ResultSummaryGrid,
} from "@razzia/web/features/manager/components/ResultModal/ResultSummaryRow"
import { matchedCounts } from "@razzia/web/features/questions/association/utils/records"
import type { ResultSummaryProps } from "@razzia/web/features/questions/types"
import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"

// The items with their letters, as the answers of a multiple choice, each
// with its right target under its words, where an ordering has its place, and
// the players who matched it. The target shares the item's width: in a column
// of its own it would leave a category's name barely anything.
const AssociationResultSummary = ({
  question,
  noAnswerCount,
}: ResultSummaryProps) => {
  const { t } = useTranslation()
  const counts = matchedCounts(question)

  return (
    <ResultSummaryGrid>
      {question.answers.map((item, index) => (
        <ResultSummaryRow
          key={index}
          mark={<AnswerChip index={index} size="sm" />}
          label={item}
          note={
            <span className="text-success-strong flex items-center gap-1 text-sm font-semibold">
              <Check aria-hidden className="size-4 shrink-0 stroke-4" />
              <span className="sr-only">{t("manager:result.expected")} :</span>
              <span className="min-w-0 truncate">
                {rightTargetOf(question, index) ?? "?"}
              </span>
            </span>
          }
          count={t("manager:result.matchedCount", { count: counts[index] })}
        />
      ))}
      <ResultSummaryRow
        label={t("manager:result.noAnswer")}
        count={String(noAnswerCount)}
        muted
      />
    </ResultSummaryGrid>
  )
}

export default AssociationResultSummary
