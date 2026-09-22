import {
  checkEstimate,
  decimalsOf,
  toPlainNumber,
  unitOf,
} from "@razzia/common/utils/estimate"
import AnswerRow, {
  AnswerReveal,
} from "@razzia/web/features/game/components/question/AnswerRow"
import SubmitAnswer from "@razzia/web/features/game/components/question/SubmitAnswer"
import { checkMessage } from "@razzia/web/features/questions/estimate/utils/format"
import KeyboardChip from "@razzia/web/features/questions/shortanswer/components/KeyboardChip"
import { ANSWER_FIELD } from "@razzia/web/features/questions/shortanswer/utils/field"
import type { AnswerComponentProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { type KeyboardEvent, useId, useState } from "react"
import { useTranslation } from "react-i18next"

// Room for a number of 12 digits, its decimals, spaces and sign.
const MAX_LENGTH = 30

// Width of the unit written over the field's right end, in em of the field's
// text: generous, so a long number stops before it. A long unit takes half
// the field at most, cut with an ellipsis on a narrow phone.
const UNIT_CHAR_WIDTH = 0.65

// Estimate: the short answer's field, for a number, with the unit at its
// right end. The help line under « Valider » shows the number as read (or
// why it cannot be sent yet), read the same way the server reads it. The
// host screen shows one row saying where to answer.
const EstimateInput = ({
  options,
  onSubmit,
  readOnly,
  locked = false,
}: AnswerComponentProps) => {
  const { t } = useTranslation()
  const inputId = useId()
  const helpId = useId()
  const [value, setValue] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const check = checkEstimate(value, options)
  const frozen = locked || submitted
  const canSubmit = !frozen && check.ok
  const unit = unitOf(options)
  // The numeric keypad has no minus sign on every phone: only a question
  // that cannot take a negative number gets it.
  const min = options?.min
  const inputMode = min !== undefined && min >= 0 ? "decimal" : "text"

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
    if (frozen || !check.ok) {
      return
    }

    setSubmitted(true)
    // A plain decimal: the server reads it back exactly.
    onSubmit({ text: toPlainNumber(check.value, decimalsOf(options)) })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter also ends a composition (accents, other scripts): not a send.
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return
    }

    event.preventDefault()
    submit()
  }

  const message = checkMessage(t, check, options)
  const label =
    unit === ""
      ? t("game:estimate.label")
      : t("game:estimate.labelUnit", { unit })

  return (
    <>
      <AnswerReveal index={0} as="div" className="relative">
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
        <input
          id={inputId}
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={frozen}
          maxLength={MAX_LENGTH}
          placeholder={t("game:estimate.label")}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="send"
          aria-describedby={helpId}
          aria-invalid={message.refused}
          className={clsx(ANSWER_FIELD, "tabular-nums")}
          style={
            unit === ""
              ? undefined
              : {
                  paddingRight: `min(calc(${Array.from(unit).length * UNIT_CHAR_WIDTH}em + 1.75rem), 50%)`,
                }
          }
        />
        {/* Read with the field's label. */}
        {unit !== "" && (
          <span
            aria-hidden
            className="text-secondary/70 pointer-events-none absolute inset-y-0 right-4 flex max-w-[calc(50%-1.25rem)] items-center text-lg font-semibold"
          >
            <span className="truncate">{unit}</span>
          </span>
        )}
      </AnswerReveal>
      <SubmitAnswer
        index={1}
        disabled={!canSubmit}
        onClick={submit}
        help={
          locked ? (
            ""
          ) : (
            <span
              className={clsx(
                "tabular-nums",
                message.refused && "text-serre-yellow font-semibold",
              )}
            >
              {message.text}
            </span>
          )
        }
        helpId={helpId}
        live={false}
      />
    </>
  )
}

export default EstimateInput
