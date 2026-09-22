import AnswerChip from "@razzia/web/features/game/components/AnswerChip"
import { useResultModal } from "@razzia/web/features/manager/contexts/result-modal-context"
import { QUESTION_REGISTRY } from "@razzia/web/features/questions"
import { Check, X } from "lucide-react"
import { useTranslation } from "react-i18next"

const ResultModalTable = () => {
  const { questionResult, getPlayerPoints } = useResultModal()
  const { t } = useTranslation()
  const { ResultCells } = QUESTION_REGISTRY[questionResult.type]

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0">
        <tr className="border-accent bg-muted text-muted-foreground border-b-2 text-left text-xs font-semibold tracking-wide uppercase">
          <th className="px-5 py-2.5">{t("manager:result.table.player")}</th>
          <th className="px-4 py-2.5">{t("manager:result.table.answered")}</th>
          <th className="px-4 py-2.5">
            {t("manager:result.table.correctIncorrect")}
          </th>
          <th className="px-4 py-2.5 text-right">
            {t("manager:result.table.points")}
          </th>
        </tr>
      </thead>
      <tbody className="divide-muted divide-y-2">
        {questionResult.playerAnswers.map((pa, i) => {
          const hasAnswer = pa.answerIds !== null && pa.answerIds.length > 0
          const isCorrect =
            pa.answerIds?.some((id) => questionResult.solutions.includes(id)) ??
            false

          // Types not answered by picking choices bring their own cells.
          if (ResultCells) {
            return (
              <tr key={i}>
                <td className="px-5 py-2.5 font-medium">{pa.playerName}</td>
                <ResultCells question={questionResult} record={pa} />
                <td className="text-foreground px-4 py-2.5 text-right font-semibold">
                  {getPlayerPoints(pa.playerName)}
                </td>
              </tr>
            )
          }

          return (
            <tr key={i}>
              <td className="px-5 py-2.5 font-medium">{pa.playerName}</td>
              <td className="px-4 py-2.5">
                {hasAnswer ? (
                  <div className="flex flex-wrap gap-1">
                    {pa.answerIds?.map((id) => (
                      <span
                        key={id}
                        className="bg-muted text-foreground inline-flex items-center gap-1.5 rounded-md py-0.5 pr-2 pl-0.5 text-xs"
                      >
                        <AnswerChip index={id} size="sm" />
                        <span className="max-w-30 truncate">
                          {questionResult.answers[id]}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs">-</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                {isCorrect ? (
                  <span className="text-success-strong flex items-center gap-1">
                    <Check className="size-4 stroke-4" />{" "}
                    {t("manager:result.table.correct")}
                  </span>
                ) : (
                  <span className="text-danger flex items-center gap-1">
                    <X className="size-4 stroke-4" />{" "}
                    {t("manager:result.table.incorrect")}
                  </span>
                )}
              </td>
              <td className="text-foreground px-4 py-2.5 text-right font-semibold">
                {getPlayerPoints(pa.playerName)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default ResultModalTable
