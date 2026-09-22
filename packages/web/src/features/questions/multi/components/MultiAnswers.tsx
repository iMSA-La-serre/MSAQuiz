import AnswerRow, {
  AnswerReveal,
} from "@razzia/web/features/game/components/question/AnswerRow"
import SubmitAnswer from "@razzia/web/features/game/components/question/SubmitAnswer"
import TickBox from "@razzia/web/features/game/components/question/TickBox"
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
    onSubmit({ answerKeys: selected })
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
                    <TickBox checked={isSelected}>
                      <Check className="size-5 stroke-3" />
                    </TickBox>
                  }
                />
              )}
            </AnswerReveal>
          )
        })}
      </ol>

      {!readOnly && (
        <SubmitAnswer
          index={answers.length}
          disabled={locked || submitted || selected.length === 0}
          onClick={handleSubmit}
          count={selected.length}
          help={
            !locked && selected.length === 0 ? t("game:answer.multiEmpty") : ""
          }
        />
      )}
    </>
  )
}

export default MultiAnswers
