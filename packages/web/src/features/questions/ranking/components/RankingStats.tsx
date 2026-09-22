import type { StatsAnswersProps } from "@razzia/web/features/questions/types"
import { useTranslation } from "react-i18next"

// The proposals in the order the games ranked them, each with the share of
// players who put it first, as on the projector.
const RankingStats = ({ question }: StatsAnswersProps) => {
  const { t } = useTranslation()
  const share = (count: number) =>
    question.answerCount === 0
      ? 0
      : Math.min(100, (count / question.answerCount) * 100)

  return (
    <>
      <p className="text-muted-foreground mt-2 text-xs font-semibold">
        {t("manager:stats.rankingOrder")}
      </p>
      <ol className="mt-1 space-y-1">
        {question.answers.map(({ label, count }, index) => (
          <li key={label} className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground flex min-w-0 flex-1 items-center gap-1 truncate">
              <span className="font-semibold tabular-nums">{index + 1}.</span>
              {label}
            </span>
            <span className="bg-muted h-1.5 w-24 shrink-0 overflow-hidden rounded-full">
              <span
                className="bg-neutral-mark block h-full rounded-full"
                style={{ width: `${share(count)}%` }}
              />
            </span>
            <span className="text-muted-foreground w-8 shrink-0 text-right tabular-nums">
              {count}
            </span>
          </li>
        ))}
      </ol>
    </>
  )
}

export default RankingStats
