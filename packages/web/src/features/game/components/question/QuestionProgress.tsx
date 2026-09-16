import clsx from "clsx"
import { useTranslation } from "react-i18next"
import { twMerge } from "tailwind-merge"

interface Props {
  current: number
  total: number
  variant: "host" | "phone"
  className?: string
}

// Up to this many questions, one segment per question; beyond, a plain bar.
const MAX_SEGMENTS = 20

// Progress through the quiz, not a timer: it never animates.
const QuestionProgress = ({ current, total, variant, className }: Props) => {
  const { t } = useTranslation()
  const title = t("game:prepared.title", { number: current })
  const height = variant === "host" ? "h-1.5 md:h-2" : "h-1"

  return (
    <div
      role="progressbar"
      aria-label={title}
      aria-valuetext={`${title} ${t("game:prepared.outOf", { total })}`}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={current}
      className={twMerge(clsx("w-full", className))}
    >
      {total <= MAX_SEGMENTS ? (
        <div aria-hidden className="flex gap-1.5">
          {Array.from({ length: total }, (_, index) => (
            <span
              key={index}
              className={clsx("flex-1 rounded-full", height, {
                "bg-primary": index < current - 1,
                "bg-white": index === current - 1,
                "bg-white/20": index > current - 1,
              })}
            />
          ))}
        </div>
      ) : (
        <div
          aria-hidden
          className={clsx("overflow-hidden rounded-full bg-white/20", height)}
        >
          <div
            className="bg-primary h-full rounded-full"
            style={{ width: `${Math.min(current / total, 1) * 100}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default QuestionProgress
