import ResultVerdict from "@razzia/web/features/manager/components/ResultModal/ResultVerdict"
import type { ResultCellsProps } from "@razzia/web/features/questions/types"
import { hasAnswered } from "@razzia/web/features/questions/wordcloud/utils/records"
import { useTranslation } from "react-i18next"

// Only whether the player answered: the words are not linked to the player.
const WordCloudResultCells = ({ record }: ResultCellsProps) => {
  const { t } = useTranslation()
  const answered = hasAnswered(record)

  return (
    <>
      <td className="px-4 py-2.5">
        <span className="text-muted-foreground text-xs">
          {answered ? t("manager:result.unlinked") : "-"}
        </span>
      </td>
      <td className="px-4 py-2.5">
        {answered ? (
          <ResultVerdict
            verdict="recorded"
            label={t("manager:result.verdict.recorded")}
          />
        ) : (
          <ResultVerdict
            verdict="noAnswer"
            label={t("manager:result.verdict.noAnswer")}
          />
        )}
      </td>
    </>
  )
}

export default WordCloudResultCells
