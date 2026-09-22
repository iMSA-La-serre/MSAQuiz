import ResultSummaryRow, {
  ResultSummaryGrid,
} from "@razzia/web/features/manager/components/ResultModal/ResultSummaryRow"
import PositionBadge from "@razzia/web/features/questions/ordering/components/PositionBadge"
import { rankedItems } from "@razzia/web/features/questions/ranking/utils/records"
import type { ResultSummaryProps } from "@razzia/web/features/questions/types"
import { useTranslation } from "react-i18next"

// The proposals in the order the room put them, each with the players who
// put it first, as on the projector.
const RankingResultSummary = ({
  question,
  noAnswerCount,
}: ResultSummaryProps) => {
  const { t } = useTranslation()

  return (
    <ResultSummaryGrid>
      {rankedItems(question).map(({ index, label, first }, position) => (
        <ResultSummaryRow
          key={index}
          mark={<PositionBadge position={position + 1} size="sm" />}
          label={label}
          count={t("manager:result.firstChoiceCount", { count: first })}
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

export default RankingResultSummary
