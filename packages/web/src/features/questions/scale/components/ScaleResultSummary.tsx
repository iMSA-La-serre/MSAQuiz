import { scaleRangeOf, scaleValues } from "@razzia/common/utils/scale"
import ResultSummaryRow, {
  ResultSummaryGrid,
} from "@razzia/web/features/manager/components/ResultModal/ResultSummaryRow"
import {
  endLabelOf,
  formatLevel,
} from "@razzia/web/features/questions/scale/utils/format"
import { scaleCountsOf } from "@razzia/web/features/questions/scale/utils/records"
import type { ResultSummaryProps } from "@razzia/web/features/questions/types"
import { EqualApproximately, Gauge } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

// The box of the word cloud's number, holding a level or an icon.
const Mark = ({ children }: { children: ReactNode }) => (
  <span className="bg-muted text-secondary flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums">
    {children}
  </span>
)

// The players of each level, then those who preferred not to answer, then
// the mean and the median. No level is linked to a player; too few answers
// and the counts were not kept.
const ScaleResultSummary = ({
  question,
  noAnswerCount,
}: ResultSummaryProps) => {
  const { t, i18n } = useTranslation()
  const range = scaleRangeOf(question.options)
  const { counts, skipped, mean, median } = scaleCountsOf(question)

  return (
    <ResultSummaryGrid>
      {question.scaleWithheld === true ? (
        // Withheld with the levels: a « Sans avis » at zero would read as
        // nobody having preferred not to answer.
        <ResultSummaryRow
          label={t("manager:result.scaleWithheld")}
          count=""
          muted
        />
      ) : (
        <>
          {/* The level is in the mark, as a word cloud has its rank there:
          the label only names the ends of the scale. */}
          {scaleValues(range).map((value, index) => (
            <ResultSummaryRow
              key={value}
              mark={<Mark>{value}</Mark>}
              label={endLabelOf(question.options, range, value)}
              count={String(counts[index] ?? 0)}
            />
          ))}
          <ResultSummaryRow
            label={t("manager:result.scaleSkipped")}
            count={String(skipped)}
            muted
          />
        </>
      )}
      {mean !== null && median !== null && (
        <>
          <ResultSummaryRow
            mark={
              <Mark>
                <Gauge aria-hidden className="size-4" />
              </Mark>
            }
            label={t("manager:result.scaleMean")}
            count={formatLevel(mean, i18n.language)}
          />
          <ResultSummaryRow
            mark={
              <Mark>
                <EqualApproximately aria-hidden className="size-4" />
              </Mark>
            }
            label={t("manager:result.median")}
            count={formatLevel(median, i18n.language)}
          />
        </>
      )}
      <ResultSummaryRow
        label={t("manager:result.noAnswer")}
        count={String(noAnswerCount)}
        muted
      />
    </ResultSummaryGrid>
  )
}

export default ScaleResultSummary
