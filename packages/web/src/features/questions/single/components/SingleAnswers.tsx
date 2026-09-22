import AnswerRow, {
  AnswerReveal,
} from "@razzia/web/features/game/components/question/AnswerRow"
import type { AnswerComponentProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { useState } from "react"

// Beyond this many characters in any answer, host rows use smaller text.
const DENSE_LENGTH = 60

// Single choice, true/false and poll: one tap sends the answer.
const SingleAnswers = ({
  answers,
  onSubmit,
  readOnly,
  locked,
  size,
  large,
}: AnswerComponentProps) => {
  const [chosen, setChosen] = useState<number | null>(null)
  const dense = answers.some((answer) => answer.length > DENSE_LENGTH)

  // The tapped row is outlined at once and every row is disabled, so a second
  // tap cannot send another answer before the server's WAIT arrives.
  const handleSelect = (key: number) => () => {
    if (locked || chosen !== null) {
      return
    }

    setChosen(key)
    onSubmit({ answerKeys: [key] })
  }

  return (
    <ol
      className={clsx(
        "flex flex-col",
        size === "host" ? "gap-3 xl:gap-4" : "gap-2",
      )}
    >
      {answers.map((answer, key) => (
        <AnswerReveal key={key} index={key}>
          <AnswerRow
            index={key}
            text={answer}
            size={size}
            locked={locked}
            dense={dense}
            large={large}
            interactive={!readOnly}
            outlined={chosen === key}
            disabled={chosen !== null}
            className={clsx({
              "opacity-60": chosen !== null && chosen !== key,
            })}
            onClick={handleSelect(key)}
          />
        </AnswerReveal>
      ))}
    </ol>
  )
}

export default SingleAnswers
