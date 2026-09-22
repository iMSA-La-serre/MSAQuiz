import ResultSummaryRow, {
  ResultSummaryGrid,
} from "@razzia/web/features/manager/components/ResultModal/ResultSummaryRow"
import {
  acceptedCounts,
  rankByCount,
  unrecognizedCount,
} from "@razzia/web/features/questions/shortanswer/utils/records"
import type { ResultSummaryProps } from "@razzia/web/features/questions/types"
import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"

// The accepted answers by number of inputs they recognized, then the inputs
// that matched none.
const ShortAnswerResultSummary = ({
  question,
  noAnswerCount,
}: ResultSummaryProps) => {
  const { t } = useTranslation()
  const accepted = question.accepted ?? []
  const counts = acceptedCounts(question)

  return (
    <ResultSummaryGrid>
      {rankByCount(counts).map((index) => (
        <ResultSummaryRow
          key={index}
          mark={
            <span className="bg-muted text-success-strong flex size-8 shrink-0 items-center justify-center rounded-lg">
              <Check aria-hidden className="size-4 stroke-3" />
            </span>
          }
          label={accepted[index]}
          count={String(counts[index])}
        />
      ))}
      <ResultSummaryRow
        label={t("manager:result.unrecognized")}
        count={String(unrecognizedCount(question))}
      />
      <ResultSummaryRow
        label={t("manager:result.noAnswer")}
        count={String(noAnswerCount)}
        muted
      />
    </ResultSummaryGrid>
  )
}

export default ShortAnswerResultSummary
