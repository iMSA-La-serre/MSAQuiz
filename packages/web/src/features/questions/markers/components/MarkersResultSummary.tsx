import ChoiceSummary from "@razzia/web/features/manager/components/ResultModal/ChoiceSummary"
import MarkerChip from "@razzia/web/features/questions/markers/components/MarkerChip"
import type { ResultSummaryProps } from "@razzia/web/features/questions/types"

// The markers as the answers of a choice — the right ones ticked, with the
// players who tapped each — numbered as the image showed them.
const MarkersResultSummary = ({
  question,
  noAnswerCount,
}: ResultSummaryProps) => (
  <ChoiceSummary
    question={question}
    noAnswerCount={noAnswerCount}
    mark={(index) => <MarkerChip index={index} size="sm" />}
  />
)

export default MarkersResultSummary
