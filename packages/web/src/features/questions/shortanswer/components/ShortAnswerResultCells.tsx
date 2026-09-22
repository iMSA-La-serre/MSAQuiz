import ResultVerdict from "@razzia/web/features/manager/components/ResultModal/ResultVerdict"
import { isRecognized } from "@razzia/web/features/questions/shortanswer/utils/records"
import type { ResultCellsProps } from "@razzia/web/features/questions/types"
import { useTranslation } from "react-i18next"

// What the player typed, the accepted answer it matched, and whether it was
// recognized.
const ShortAnswerResultCells = ({ question, record }: ResultCellsProps) => {
  const { t } = useTranslation()
  const { answerIds, text } = record
  const matched =
    answerIds !== null && answerIds.length > 0
      ? question.accepted?.at(answerIds[0])
      : undefined

  const renderVerdict = () => {
    if (answerIds === null) {
      return (
        <ResultVerdict
          verdict="noAnswer"
          label={t("manager:result.verdict.noAnswer")}
        />
      )
    }

    return isRecognized(record) ? (
      <ResultVerdict
        verdict="correct"
        label={t("manager:result.verdict.recognized")}
      />
    ) : (
      <ResultVerdict
        verdict="wrong"
        label={t("manager:result.verdict.unrecognized")}
      />
    )
  }

  return (
    <>
      <td className="px-4 py-2.5">
        {typeof text === "string" ? (
          <span className="flex flex-col text-xs">
            <span className="text-foreground font-semibold break-words">
              {t("manager:result.typed", { text })}
            </span>
            {matched !== undefined && (
              <span className="text-muted-foreground break-words">
                {t("manager:result.matched", { answer: matched })}
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )}
      </td>
      <td className="px-4 py-2.5">{renderVerdict()}</td>
    </>
  )
}

export default ShortAnswerResultCells
