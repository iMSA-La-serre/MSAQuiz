import Button from "@razzia/web/components/Button"
import AnswerRow, {
  AnswerReveal,
} from "@razzia/web/features/game/components/question/AnswerRow"
import type { AnswerComponentProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { Check } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

// Beyond this many characters in any answer, host rows use smaller text.
const DENSE_LENGTH = 60

// Several answers: rows are toggles, then one "Valider" sends them all.
const MultiAnswers = ({
  answers,
  onSubmit,
  readOnly,
  locked = false,
  size,
}: AnswerComponentProps) => {
  const [selected, setSelected] = useState<number[]>([])
  const [submitted, setSubmitted] = useState(false)
  const { t } = useTranslation()
  const dense = answers.some((answer) => answer.length > DENSE_LENGTH)

  const handleSubmit = () => {
    if (locked || submitted || selected.length === 0) {
      return
    }

    setSubmitted(true)
    onSubmit(selected)
  }

  const toggle = (key: number) => () => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  return (
    <>
      <ol
        className={clsx(
          "flex flex-col",
          size === "host" ? "gap-3 xl:gap-4" : "gap-2",
        )}
      >
        {answers.map((answer, key) => {
          const isSelected = selected.includes(key)

          return (
            <AnswerReveal key={key} index={key}>
              {readOnly ? (
                <AnswerRow
                  index={key}
                  text={answer}
                  size={size}
                  locked={locked}
                  dense={dense}
                />
              ) : (
                <AnswerRow
                  index={key}
                  text={answer}
                  size={size}
                  locked={locked}
                  dense={dense}
                  interactive
                  role="checkbox"
                  aria-checked={isSelected}
                  outlined={isSelected}
                  disabled={submitted}
                  onClick={toggle(key)}
                  trailing={
                    <span
                      aria-hidden
                      className={clsx(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg",
                        isSelected
                          ? "bg-primary text-white"
                          : "border-secondary/60 border-2",
                      )}
                    >
                      {isSelected && <Check className="size-5 stroke-3" />}
                    </span>
                  }
                />
              )}
            </AnswerReveal>
          )
        })}
      </ol>

      {!readOnly && (
        <AnswerReveal
          index={answers.length}
          as="div"
          className="mt-2 flex flex-col gap-2"
        >
          {/* Shown disabled during the reading time, so nothing jumps when
          answering opens. */}
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={locked || submitted || selected.length === 0}
            className="focus-visible:outline-serre-yellow min-h-14 w-full rounded-2xl text-xl font-bold focus-visible:outline-3 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/70 disabled:hover:brightness-100"
          >
            {t("game:confirm")}
            {selected.length > 0 && (
              <span className="bg-secondary rounded-full px-2.5 text-lg text-white tabular-nums">
                {selected.length}
              </span>
            )}
          </Button>
          <p
            aria-live="polite"
            className="min-h-5 text-center text-sm text-white/80"
          >
            {!locked && selected.length === 0
              ? t("game:answer.multiEmpty")
              : ""}
          </p>
        </AnswerReveal>
      )}
    </>
  )
}

export default MultiAnswers
