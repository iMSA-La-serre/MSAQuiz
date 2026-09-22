import { SHORTANSWER_LIMITS } from "@razzia/common/constants"
import { cleanInput, countInputChars } from "@razzia/common/utils/text"
import AnswerRow, {
  AnswerReveal,
} from "@razzia/web/features/game/components/question/AnswerRow"
import SubmitAnswer from "@razzia/web/features/game/components/question/SubmitAnswer"
import KeyboardChip from "@razzia/web/features/questions/shortanswer/components/KeyboardChip"
import type { AnswerComponentProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { type KeyboardEvent, useId, useState } from "react"
import { useTranslation } from "react-i18next"

const MAX_LENGTH = SHORTANSWER_LIMITS.INPUT_LENGTH

// The phone answer row, as a field: same card, height and text. 18 px text:
// from 16 px up, iOS does not zoom into the field. Focused, it takes the
// green ring of a picked row: a text field matches :focus-visible on every
// tap, so the yellow keyboard outline would show to everyone typing. A field
// reached with Tab or raised by the keyboard scrolls into view with
// « Valider » below it.
const FIELD =
  "text-secondary placeholder:text-secondary/70 focus:ring-primary ease-out-quart min-h-16 w-full scroll-mb-28 rounded-2xl bg-white px-4 py-2.5 text-lg leading-snug font-semibold shadow-lg shadow-black/15 transition-[background-color,box-shadow] duration-300 focus:ring-4 focus:outline-none disabled:bg-white/70 disabled:opacity-100 disabled:shadow-none motion-reduce:transition-none"

// Short answer: one field in place of the answer rows, sent with « Valider »
// or the keyboard's send key. The host screen shows one row saying where to
// answer.
const ShortAnswerInput = ({
  onSubmit,
  readOnly,
  locked = false,
}: AnswerComponentProps) => {
  const { t } = useTranslation()
  const inputId = useId()
  const helpId = useId()
  const [value, setValue] = useState("")
  const [submitted, setSubmitted] = useState(false)
  // Counted like the server counts: what is left once the text is cleaned.
  const count = countInputChars(value)
  const frozen = locked || submitted
  const canSubmit = !frozen && count > 0 && count <= MAX_LENGTH

  if (readOnly) {
    return (
      <AnswerReveal index={0} as="div">
        <AnswerRow
          index={0}
          size="host"
          locked={locked}
          text={t(
            locked
              ? "game:shortanswer.hostReading"
              : "game:shortanswer.hostTyping",
          )}
          marker={<KeyboardChip />}
        />
      </AnswerReveal>
    )
  }

  const submit = () => {
    if (!canSubmit) {
      return
    }

    setSubmitted(true)
    onSubmit({ text: cleanInput(value) })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter also ends a composition (accents, other scripts): not a send.
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return
    }

    event.preventDefault()
    submit()
  }

  const renderHelp = () => {
    if (locked) {
      return ""
    }

    if (count === 0) {
      return t("game:answer.shortanswerEmpty")
    }

    return (
      <span
        className={clsx(
          "tabular-nums",
          count > MAX_LENGTH && "text-serre-yellow font-semibold",
        )}
      >
        <span aria-hidden>
          {t("game:shortanswer.counter", { count, max: MAX_LENGTH })}
        </span>
        <span className="sr-only">
          {t("game:shortanswer.counterLabel", { count, max: MAX_LENGTH })}
        </span>
      </span>
    )
  }

  return (
    <>
      <AnswerReveal index={0} as="div">
        <label htmlFor={inputId} className="sr-only">
          {t("game:shortanswer.label")}
        </label>
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={frozen}
          maxLength={MAX_LENGTH}
          placeholder={t("game:shortanswer.label")}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="send"
          aria-describedby={helpId}
          className={FIELD}
        />
      </AnswerReveal>
      <SubmitAnswer
        index={1}
        disabled={!canSubmit}
        onClick={submit}
        help={renderHelp()}
        helpId={helpId}
        live={false}
      />
    </>
  )
}

export default ShortAnswerInput
