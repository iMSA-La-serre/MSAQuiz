import ResultSummaryRow, {
  ResultSummaryGrid,
} from "@razzia/web/features/manager/components/ResultModal/ResultSummaryRow"
import type { ResultSummaryProps } from "@razzia/web/features/questions/types"
import { namedWords } from "@razzia/web/features/questions/wordcloud/utils/records"
import { useTranslation } from "react-i18next"

// Words listed by name in the answers block; the table below stays in view.
const NAMED_WORDS = 8

// The words typed, the most frequent first, with how many players typed
// each, then the other words summed, then the players with no answer. Words
// typed by too few players were not kept: the block says so.
const WordCloudResultSummary = ({
  question,
  noAnswerCount,
}: ResultSummaryProps) => {
  const { t } = useTranslation()
  const { named, others } = namedWords(question, NAMED_WORDS)

  return (
    <ResultSummaryGrid>
      {question.wordsWithheld === true && (
        <ResultSummaryRow
          label={t("manager:result.wordsWithheld")}
          count=""
          muted
        />
      )}
      {named.map(({ text, count }, index) => (
        <ResultSummaryRow
          key={text}
          mark={
            <span className="bg-muted text-secondary flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums">
              {index + 1}
            </span>
          }
          label={text}
          count={String(count)}
        />
      ))}
      {others.words > 0 && (
        <ResultSummaryRow
          label={t("manager:result.otherWords", { count: others.words })}
          count={String(others.count)}
        />
      )}
      {named.length === 0 && question.wordsWithheld !== true && (
        <ResultSummaryRow label={t("manager:result.noWord")} count="0" muted />
      )}
      <ResultSummaryRow
        label={t("manager:result.noAnswer")}
        count={String(noAnswerCount)}
        muted
      />
    </ResultSummaryGrid>
  )
}

export default WordCloudResultSummary
