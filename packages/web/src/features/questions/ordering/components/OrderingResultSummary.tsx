import ResultSummaryRow, {
  ResultSummaryGrid,
} from "@razzia/web/features/manager/components/ResultModal/ResultSummaryRow"
import PositionBadge from "@razzia/web/features/questions/ordering/components/PositionBadge"
import { placedCounts } from "@razzia/web/features/questions/ordering/utils/records"
import type { ResultSummaryProps } from "@razzia/web/features/questions/types"
import { useTranslation } from "react-i18next"

// The correct order, with the players who put each item at its place.
const OrderingResultSummary = ({
  question,
  noAnswerCount,
}: ResultSummaryProps) => {
  const { t } = useTranslation()
  const counts = placedCounts(question)

  return (
    <ResultSummaryGrid>
      {question.answers.map((item, index) => (
        <ResultSummaryRow
          key={index}
          mark={<PositionBadge position={index + 1} size="sm" />}
          label={item}
          count={t("manager:result.placedCount", { count: counts[index] })}
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

export default OrderingResultSummary
