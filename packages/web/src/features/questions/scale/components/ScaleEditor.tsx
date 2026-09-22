import { SCALE_LIMITS } from "@razzia/common/constants"
import { scaleRangeOf, scaleSkipAllowed } from "@razzia/common/utils/scale"
import { Chip } from "@razzia/web/features/game/components/AnswerChip"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { CircleSlash, Link2Off, type LucideIcon } from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"

const FIELD =
  "border-muted-foreground/80 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary w-full rounded-lg border bg-white px-3 py-2.5 text-base font-semibold outline-none focus:ring-2"

const HEADING =
  "text-muted-foreground text-xs font-semibold tracking-[0.15em] uppercase"

// The columns of the choice editor, without the correct-answer box: chip,
// field.
const COLUMNS = "grid-cols-[2rem_minmax(0,1fr)]"

const ROW = clsx("grid items-center gap-x-3 gap-y-2 py-2.5", COLUMNS)

// The rows that say how the scale plays, with an icon in the chip's box, as
// a word cloud's.
const InfoRow = ({ icon: Icon, text }: { icon: LucideIcon; text: string }) => (
  <li className={ROW}>
    <Chip aria-hidden size="sm" className="bg-muted text-secondary">
      <Icon className="size-4" />
    </Chip>
    <p className="text-sm">{text}</p>
  </li>
)

// What each end of the scale stands for, in the rows of the answers block;
// the levels themselves are a setting of the side panel.
const ScaleEditor = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const idPrefix = useId()
  const { options } = currentQuestion
  const range = scaleRangeOf(options)

  const setLabel = (end: "scaleLow" | "scaleHigh", value: string) => {
    updateQuestion(currentIndex, { options: { ...options, [end]: value } })
  }

  const ends = [
    {
      end: "scaleLow",
      value: range.min,
      text: options?.scaleLow ?? "",
      label: t("quizz:scale.lowLabel", { value: range.min }),
      placeholder: t("quizz:scale.lowPlaceholder"),
    },
    {
      end: "scaleHigh",
      value: range.max,
      text: options?.scaleHigh ?? "",
      label: t("quizz:scale.highLabel", { value: range.max }),
      placeholder: t("quizz:scale.highPlaceholder"),
    },
  ] as const

  return (
    <section
      aria-labelledby={`${idPrefix}-title`}
      className="bg-background text-foreground z-10 rounded-2xl p-4 shadow-sm md:p-6"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-3">
          <h3 id={`${idPrefix}-title`} className="text-lg font-bold">
            {t("quizz:scale.title")}
          </h3>
          <span className="text-muted-foreground text-sm font-semibold tabular-nums">
            {t("quizz:scale.range", { min: range.min, max: range.max })}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          {t("quizz:answers.hint.scale")}
        </p>
      </header>

      <div
        aria-hidden
        className={clsx("hidden gap-x-3 px-1 pb-2 sm:grid", HEADING, COLUMNS)}
      >
        <span />
        <span>{t("quizz:scale.columnLabel")}</span>
      </div>

      <ul className="divide-muted flex flex-col divide-y">
        {ends.map(({ end, value, text, label, placeholder }) => (
          <li key={end} className={ROW}>
            {/* The letter chip's box, holding the level it names. */}
            <Chip
              aria-hidden
              size="sm"
              className="bg-muted text-secondary tabular-nums"
            >
              {value}
            </Chip>
            <input
              className={FIELD}
              placeholder={placeholder}
              aria-label={label}
              maxLength={SCALE_LIMITS.LABEL_LENGTH}
              autoComplete="off"
              value={text}
              onChange={(event) => setLabel(end, event.target.value)}
            />
          </li>
        ))}
        <InfoRow icon={Link2Off} text={t("quizz:scale.unlinked")} />
        <InfoRow
          icon={CircleSlash}
          text={t(
            scaleSkipAllowed(options)
              ? "quizz:scale.skipOn"
              : "quizz:scale.skipOff",
          )}
        />
      </ul>
    </section>
  )
}

export default ScaleEditor
