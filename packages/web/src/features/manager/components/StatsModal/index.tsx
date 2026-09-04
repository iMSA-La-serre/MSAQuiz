import type { QuestionStats, QuizzStats } from "@razzia/common/types/game"
import { QUESTION_REGISTRY } from "@razzia/web/features/questions"
import { formatRate, rateColor } from "@razzia/web/features/manager/utils/stats"
import clsx from "clsx"
import { Check, X } from "lucide-react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  stats: QuizzStats
  onClose: () => void
}

const QuestionCard = ({ question }: { question: QuestionStats }) => {
  const { t } = useTranslation()
  const share = (count: number) =>
    question.answerCount === 0 ? 0 : (count / question.answerCount) * 100

  return (
    <div className="border-accent rounded-lg border-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-foreground min-w-0 flex-1 font-medium">
          {question.question}
        </p>
        <span className="text-foreground shrink-0 text-sm font-semibold">
          {question.scored
            ? formatRate(question.successRate)
            : t("manager:stats.unscored")}
        </span>
      </div>

      {question.scored && question.successRate !== null && (
        <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={clsx(
              "h-full rounded-full",
              rateColor(question.successRate),
            )}
            style={{ width: `${question.successRate * 100}%` }}
          />
        </div>
      )}

      <p className="text-muted-foreground mt-2 text-xs">
        {t(QUESTION_REGISTRY[question.type].labelKey)} ·{" "}
        {t("manager:stats.answered", { count: question.answerCount })} ·{" "}
        {t("manager:stats.missing", { count: question.missingCount })}
      </p>

      {question.answers.length > 0 && (
        <ul className="mt-2 space-y-1">
          {question.answers.map((answer) => {
            const isSolution = question.solutionLabels.includes(answer.label)

            return (
              <li
                key={answer.label}
                className="flex items-center gap-2 text-xs"
              >
                <span
                  className={clsx(
                    "flex min-w-0 flex-1 items-center gap-1 truncate",
                    isSolution ? "text-green-600" : "text-muted-foreground",
                  )}
                >
                  {isSolution && <Check className="size-3 shrink-0" />}
                  {answer.label}
                </span>
                <span className="bg-muted h-1.5 w-24 shrink-0 overflow-hidden rounded-full">
                  <span
                    className={clsx(
                      "block h-full rounded-full",
                      isSolution ? "bg-green-500" : "bg-gray-400",
                    )}
                    style={{ width: `${share(answer.count)}%` }}
                  />
                </span>
                <span className="text-muted-foreground w-8 shrink-0 text-right">
                  {answer.count}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const StatsModal = ({ stats, onClose }: Props) => {
  const { t } = useTranslation()

  useEffect(() => {
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl shadow-2xl">
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-foreground truncate text-lg font-semibold">
              {stats.subject}
            </p>
            <p className="text-muted-foreground text-xs">
              {t("manager:stats.gameCount", { count: stats.gameCount })} ·{" "}
              {t("manager:stats.playerCount", { count: stats.playerCount })}
            </p>
          </div>
          <button
            className="hover:bg-accent shrink-0 rounded-sm p-1.5"
            onClick={onClose}
            title={t("common:exit")}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
          {stats.questions.map((question) => (
            <QuestionCard key={question.question} question={question} />
          ))}

          {stats.questions.length === 0 && (
            <p className="text-muted-foreground my-8 text-center">
              {t("manager:stats.noQuestion")}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default StatsModal
