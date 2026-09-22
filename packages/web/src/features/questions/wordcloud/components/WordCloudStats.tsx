import type { StatsAnswersProps } from "@razzia/web/features/questions/types"
import { useTranslation } from "react-i18next"

// Words listed on a statistics card.
const LISTED_WORDS = 10

// The most frequent words across the games, with how many players typed
// each: the bar is their share of the answers.
const WordCloudStats = ({ question }: StatsAnswersProps) => {
  const { t } = useTranslation()
  const share = (count: number) =>
    question.answerCount === 0
      ? 0
      : Math.min(100, (count / question.answerCount) * 100)
  const words = question.answers.slice(0, LISTED_WORDS)

  if (words.length === 0) {
    return (
      <p className="text-muted-foreground mt-2 text-xs">
        {t(
          question.wordsWithheld === true
            ? "manager:stats.wordsWithheld"
            : "manager:stats.noWord",
        )}
      </p>
    )
  }

  return (
    <ul className="mt-2 space-y-1">
      {words.map(({ label, count }) => (
        <li key={label} className="flex items-center gap-2 text-xs">
          <span className="text-foreground min-w-0 flex-1 truncate">
            {label}
          </span>
          <span className="bg-muted h-1.5 w-24 shrink-0 overflow-hidden rounded-full">
            <span
              className="bg-neutral-mark block h-full rounded-full"
              style={{ width: `${share(count)}%` }}
            />
          </span>
          <span className="text-muted-foreground w-8 shrink-0 text-right">
            {count}
          </span>
        </li>
      ))}
    </ul>
  )
}

export default WordCloudStats
