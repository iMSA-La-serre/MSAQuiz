import { WORDCLOUD_LIMITS } from "@razzia/common/constants"
import { cleanInput, countInputChars } from "@razzia/common/utils/text"
import { wordCountOf } from "@razzia/common/utils/wordcloud"
import AnswerRow, {
  AnswerReveal,
} from "@razzia/web/features/game/components/question/AnswerRow"
import SubmitAnswer from "@razzia/web/features/game/components/question/SubmitAnswer"
import KeyboardChip from "@razzia/web/features/questions/shortanswer/components/KeyboardChip"
import { ANSWER_FIELD } from "@razzia/web/features/questions/shortanswer/utils/field"
import type { AnswerComponentProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { type KeyboardEvent, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

const MAX_LENGTH = WORDCLOUD_LIMITS.WORD_LENGTH

// Word cloud: one to three fields in place of the answer rows, the short
// answer's field each. Enter goes to the next field, then sends; empty fields
// are left out. The host screen shows one row saying where to answer.
const WordCloudInput = ({
  options,
  onSubmit,
  readOnly,
  locked = false,
}: AnswerComponentProps) => {
  const { t } = useTranslation()
  const idPrefix = useId()
  const helpId = `${idPrefix}-help`
  const fieldCount = wordCountOf(options)
  const [values, setValues] = useState<string[]>(() =>
    Array.from({ length: fieldCount }, () => ""),
  )
  // The field whose length the help line counts: the last one focused.
  const [active, setActive] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  // Counted like the server counts: what is left once the text is cleaned.
  const lengths = values.map(countInputChars)
  const words = values.filter((_, index) => lengths[index] > 0)
  const frozen = locked || submitted
  const canSubmit =
    !frozen &&
    words.length > 0 &&
    lengths.every((length) => length <= MAX_LENGTH)

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
    onSubmit({ texts: words.map(cleanInput) })
  }

  const update = (index: number, value: string) => {
    setValues((current) =>
      current.map((text, i) => (i === index ? value : text)),
    )
  }

  const handleKeyDown =
    (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
      // Enter also ends a composition (accents, other scripts): not a send.
      if (event.key !== "Enter" || event.nativeEvent.isComposing) {
        return
      }

      event.preventDefault()

      const next = inputs.current[index + 1]

      if (next) {
        next.focus()

        return
      }

      submit()
    }

  const renderHelp = () => {
    if (locked) {
      return ""
    }

    if (words.length === 0) {
      return t("game:answer.wordcloudEmpty", { count: fieldCount })
    }

    const count = lengths[active]

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

  const labelOf = (number: number) =>
    fieldCount === 1
      ? t("game:wordcloud.field")
      : t("game:wordcloud.fieldNumbered", { number, count: fieldCount })

  return (
    <>
      {values.map((value, index) => {
        const inputId = `${idPrefix}-${index}`
        const isLast = index === fieldCount - 1

        return (
          <AnswerReveal key={index} index={index} as="div">
            <label htmlFor={inputId} className="sr-only">
              {labelOf(index + 1)}
            </label>
            <input
              ref={(element) => {
                inputs.current[index] = element
              }}
              id={inputId}
              type="text"
              value={value}
              onChange={(event) => update(index, event.target.value)}
              onFocus={() => setActive(index)}
              onKeyDown={handleKeyDown(index)}
              disabled={frozen}
              maxLength={MAX_LENGTH}
              placeholder={
                fieldCount === 1
                  ? t("game:wordcloud.placeholder")
                  : t("game:wordcloud.placeholderNumbered", {
                      number: index + 1,
                    })
              }
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint={isLast ? "send" : "next"}
              aria-describedby={helpId}
              className={ANSWER_FIELD}
            />
          </AnswerReveal>
        )
      })}
      <SubmitAnswer
        index={fieldCount}
        disabled={!canSubmit}
        onClick={submit}
        count={fieldCount > 1 ? words.length : 0}
        help={renderHelp()}
        helpId={helpId}
        live={false}
      />
    </>
  )
}

export default WordCloudInput
