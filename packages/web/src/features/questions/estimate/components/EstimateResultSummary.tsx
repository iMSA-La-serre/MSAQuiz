import {
  estimateRanges,
  formatEstimate,
  medianOf,
} from "@razzia/common/utils/estimate"
import ResultSummaryRow, {
  ResultSummaryGrid,
} from "@razzia/web/features/manager/components/ResultModal/ResultSummaryRow"
import { rangeText } from "@razzia/web/features/questions/estimate/utils/format"
import { rangeIcon } from "@razzia/web/features/questions/estimate/utils/range-icon"
import { valuesOf } from "@razzia/web/features/questions/estimate/utils/records"
import type { ResultSummaryProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { EqualApproximately, type LucideIcon, Target } from "lucide-react"
import { useTranslation } from "react-i18next"

// The box of the short answer's tick, holding another icon.
const Mark = ({
  icon: Icon,
  right = false,
}: {
  icon: LucideIcon
  right?: boolean
}) => (
  <span
    className={clsx(
      "bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg",
      right ? "text-success-strong" : "text-secondary",
    )}
  >
    <Icon aria-hidden className={clsx("size-4", right && "stroke-3")} />
  </span>
)

// The right value, then the numbers sent by range around it, as on the
// projector, then their median.
const EstimateResultSummary = ({
  question,
  noAnswerCount,
}: ResultSummaryProps) => {
  const { t } = useTranslation()
  const { expected, options } = question
  const values = valuesOf(question)
  const ranges = estimateRanges(question, values)
  const median = medianOf(values)
  const rightIndex = ranges.findIndex(({ correct }) => correct)

  return (
    <ResultSummaryGrid>
      {expected !== undefined && (
        <ResultSummaryRow
          mark={<Mark icon={Target} />}
          label={t("manager:result.expected")}
          count={formatEstimate(expected, options)}
        />
      )}
      {ranges.map((range, index) => (
        <ResultSummaryRow
          key={index}
          mark={
            <Mark icon={rangeIcon(index - rightIndex)} right={range.correct} />
          }
          label={rangeText(t, ranges, { index, options })}
          count={String(range.count)}
        />
      ))}
      {median !== null && (
        <ResultSummaryRow
          mark={<Mark icon={EqualApproximately} />}
          label={t("manager:result.median")}
          count={formatEstimate(median, options, { extraDigits: 1 })}
        />
      )}
      <ResultSummaryRow
        label={t("manager:result.noAnswer")}
        count={String(noAnswerCount)}
        muted
      />
    </ResultSummaryGrid>
  )
}

export default EstimateResultSummary
