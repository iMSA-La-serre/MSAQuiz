import Button from "@razzia/web/components/Button"
import { AnswerReveal } from "@razzia/web/features/game/components/question/AnswerRow"
import clsx from "clsx"
import type { ReactNode, Ref } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  // Position in the rows' entrance, after the last row.
  index: number
  disabled: boolean
  onClick: () => void
  // In a pill after « Valider » when above 0: answers ticked, items numbered.
  count?: number
  // The count is short of what « Valider » needs (an ordering not fully
  // numbered): the pill is dimmed with the label.
  countPending?: boolean
  // Under the button while it cannot be used yet, or a short answer's
  // character count; empty otherwise.
  help: ReactNode
  // Lets a field point at the help line (aria-describedby).
  helpId?: string
  // Announce each change of the help line. Off for a count that changes on
  // every keystroke: the field it describes reads it instead.
  live?: boolean
  // The button and its help line, to scroll them into view.
  ref?: Ref<HTMLDivElement>
}

// « Valider » under the rows of the types answered in several taps, and under
// the short answer's field.
const SubmitAnswer = ({
  index,
  disabled,
  onClick,
  count = 0,
  countPending = false,
  help,
  helpId,
  live = true,
  ref,
}: Props) => {
  const { t } = useTranslation()

  return (
    <AnswerReveal
      ref={ref}
      index={index}
      as="div"
      className="mt-2 flex flex-col gap-2"
    >
      {/* Shown disabled during the reading time, so nothing jumps when
      answering opens. */}
      <Button
        size="lg"
        onClick={onClick}
        disabled={disabled}
        className="focus-visible:outline-serre-yellow min-h-14 w-full rounded-2xl text-xl font-bold focus-visible:outline-3 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/70 disabled:hover:brightness-100"
      >
        {t("game:confirm")}
        {count > 0 && (
          <span
            className={clsx(
              "rounded-full px-2.5 text-lg tabular-nums",
              countPending
                ? "bg-secondary/50 text-white/70"
                : "bg-secondary text-white",
            )}
          >
            {count}
          </span>
        )}
      </Button>
      <p
        id={helpId}
        aria-live={live ? "polite" : undefined}
        className="min-h-5 text-center text-sm text-white/80"
      >
        {help}
      </p>
    </AnswerReveal>
  )
}

export default SubmitAnswer
