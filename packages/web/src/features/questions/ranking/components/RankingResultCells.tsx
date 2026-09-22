import ResultVerdict from "@razzia/web/features/manager/components/ResultModal/ResultVerdict"
import PositionBadge from "@razzia/web/features/questions/ordering/components/PositionBadge"
import type { ResultCellsProps } from "@razzia/web/features/questions/types"
import { useTranslation } from "react-i18next"

// The order a player put the proposals in, and whether it was recorded:
// a ranking has no right order.
const RankingResultCells = ({ question, record }: ResultCellsProps) => {
  const { t } = useTranslation()
  const { answerIds } = record

  return (
    <>
      <td className="px-4 py-2.5">
        {answerIds === null || answerIds.length === 0 ? (
          <span className="text-muted-foreground text-xs">-</span>
        ) : (
          <ol className="flex flex-wrap gap-1">
            {answerIds.map((id, index) => (
              <li
                key={index}
                className="bg-muted text-foreground inline-flex items-center gap-1.5 rounded-md py-0.5 pr-2 pl-0.5 text-xs"
              >
                <PositionBadge position={index + 1} size="xs" />
                <span className="max-w-30 truncate">
                  {question.answers.at(id) ?? "?"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </td>
      <td className="px-4 py-2.5">
        {answerIds === null || answerIds.length === 0 ? (
          <ResultVerdict
            verdict="noAnswer"
            label={t("manager:result.verdict.noAnswer")}
          />
        ) : (
          <ResultVerdict
            verdict="recorded"
            label={t("manager:result.verdict.recorded")}
          />
        )}
      </td>
    </>
  )
}

export default RankingResultCells
