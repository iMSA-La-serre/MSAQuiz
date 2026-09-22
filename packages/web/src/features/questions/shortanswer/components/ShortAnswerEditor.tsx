import { SHORTANSWER_LIMITS } from "@razzia/common/constants"
import { answerKey, matchAccepted } from "@razzia/common/utils/text"
import { Chip } from "@razzia/web/features/game/components/AnswerChip"
import { duplicatesOf } from "@razzia/web/features/questions/keys"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Check, FlaskConical, Plus, Trash2 } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

const { ACCEPTED_COUNT, ACCEPTED_LENGTH, INPUT_LENGTH } = SHORTANSWER_LIMITS

const WHITE_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"

const FIELD =
  "border-muted-foreground/80 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary aria-invalid:border-danger w-full rounded-lg border bg-white px-3 py-2.5 text-base font-semibold outline-none focus:ring-2"

// The columns of the poll editor: chip, field, delete. The delete button
// keeps its 44 px target below sm, on the field's line.
const COLUMNS = "sm:grid-cols-[2rem_minmax(0,1fr)_2.25rem]"

// The comparison key goes on a second line, under the field.
const ROW = clsx(
  "grid grid-cols-[2rem_minmax(0,1fr)_2.75rem] items-center gap-x-3 gap-y-1 py-2.5",
  COLUMNS,
)

interface KeyNote {
  text: string
  invalid: boolean
}

// The answers a typed text is compared with. Each field shows the key it is
// compared as, so the author sees what case, accents and punctuation become;
// the test field tells whether a given input would score.
const ShortAnswerEditor = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const idPrefix = useId()
  const [sample, setSample] = useState("")
  const accepted = currentQuestion.accepted ?? []
  const typoTolerance = currentQuestion.options?.typoTolerance ?? false
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const addButton = useRef<HTMLButtonElement>(null)
  // Row whose field gets focus after an add or a delete. When that row no
  // longer exists, focus goes to the add button.
  const pendingFocus = useRef<number | null>(null)

  useEffect(() => {
    const target = pendingFocus.current

    if (target === null) {
      return
    }

    pendingFocus.current = null
    const input = inputs.current[target]

    if (input) {
      input.focus()

      return
    }

    addButton.current?.focus()
  })

  const canAdd = accepted.length < ACCEPTED_COUNT
  const canRemove = accepted.length > 1
  const duplicates = duplicatesOf(accepted)

  const setAccepted = (next: string[]) => {
    updateQuestion(currentIndex, { accepted: next })
  }

  const updateAnswer = (index: number, value: string) => {
    setAccepted(accepted.map((answer, i) => (i === index ? value : answer)))
  }

  const addAnswer = () => {
    if (!canAdd) {
      return
    }

    pendingFocus.current = accepted.length
    setAccepted([...accepted, ""])
  }

  const removeAnswer = (index: number) => {
    if (!canRemove) {
      return
    }

    pendingFocus.current = index
    setAccepted(accepted.filter((_, i) => i !== index))
  }

  const keyNote = (answer: string, index: number): KeyNote | null => {
    if (answer.trim() === "") {
      return null
    }

    const key = answerKey(answer)
    const first = duplicates.get(index)

    if (key === "") {
      return { text: t("quizz:shortanswer.noKey"), invalid: true }
    }

    if (first !== undefined) {
      return {
        text: t("quizz:shortanswer.duplicateOf", { number: first + 1 }),
        invalid: true,
      }
    }

    return { text: t("quizz:shortanswer.comparedAs", { key }), invalid: false }
  }

  const renderTestResult = () => {
    if (sample.trim() === "") {
      return (
        <span className="text-muted-foreground">
          {t("quizz:shortanswer.testHint")}
        </span>
      )
    }

    const match = matchAccepted(accepted, sample, { typoTolerance })

    return match === -1 ? (
      <span className="text-danger font-semibold">
        {t("quizz:shortanswer.testRejected")}
      </span>
    ) : (
      <span className="text-success-strong font-semibold">
        {t("quizz:shortanswer.testAccepted", { answer: accepted[match] })}
      </span>
    )
  }

  return (
    <section
      aria-labelledby={`${idPrefix}-title`}
      className="bg-background text-foreground z-10 rounded-2xl p-4 shadow-sm md:p-6"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-3">
          <h3 id={`${idPrefix}-title`} className="text-lg font-bold">
            {t("quizz:shortanswer.title")}
          </h3>
          <span className="text-muted-foreground text-sm font-semibold tabular-nums">
            {t("quizz:answers.count", {
              count: accepted.length,
              max: ACCEPTED_COUNT,
            })}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          {t("quizz:answers.hint.shortanswer")}
        </p>
      </header>

      <div
        aria-hidden
        className={clsx(
          "text-muted-foreground hidden gap-x-3 px-1 pb-2 text-xs font-semibold tracking-[0.15em] uppercase sm:grid",
          COLUMNS,
        )}
      >
        <span />
        <span>{t("quizz:shortanswer.columnAnswer")}</span>
        <span />
      </div>

      <ol className="divide-muted flex flex-col divide-y">
        {accepted.map((answer, index) => {
          const number = index + 1
          const note = keyNote(answer, index)
          const noteId = `${idPrefix}-note-${index}`

          return (
            <li key={index} className={ROW}>
              {/* The letter chip's box, neutral: every accepted answer is a
              right one. */}
              <Chip
                aria-hidden
                size="sm"
                className="bg-muted text-success-strong"
              >
                <Check className="size-4 stroke-3" />
              </Chip>
              <input
                ref={(element) => {
                  inputs.current[index] = element
                }}
                className={FIELD}
                placeholder={t("quizz:shortanswer.placeholder", { number })}
                aria-label={t("quizz:shortanswer.placeholder", { number })}
                aria-invalid={note?.invalid}
                aria-describedby={note ? noteId : undefined}
                maxLength={ACCEPTED_LENGTH}
                value={answer}
                onChange={(event) => updateAnswer(index, event.target.value)}
              />
              <button
                type="button"
                onClick={() => removeAnswer(index)}
                disabled={!canRemove}
                aria-label={t("quizz:shortanswer.remove", { number })}
                className={clsx(
                  "text-muted-foreground enabled:hover:bg-danger-subtle enabled:hover:text-danger flex size-11 items-center justify-center rounded-lg disabled:opacity-40 sm:size-9",
                  WHITE_FOCUS,
                )}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
              {note && (
                <p
                  id={noteId}
                  className={clsx(
                    "col-start-2 text-xs break-words",
                    note.invalid
                      ? "text-danger font-semibold"
                      : "text-muted-foreground",
                  )}
                >
                  {note.text}
                </p>
              )}
            </li>
          )
        })}
      </ol>

      <button
        ref={addButton}
        type="button"
        onClick={addAnswer}
        disabled={!canAdd}
        className={clsx(
          "border-accent text-muted-foreground enabled:hover:border-primary enabled:hover:text-foreground mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-sm font-semibold disabled:opacity-40",
          WHITE_FOCUS,
        )}
      >
        <Plus className="size-4" aria-hidden />
        {t("quizz:shortanswer.add")}
      </button>

      {/* Stacked as a setting of the side panel: label, field, verdict. The
      card is narrow on a laptop, whatever the window. */}
      <div className="bg-muted mt-4 flex flex-col gap-1.5 rounded-xl p-3">
        <label
          htmlFor={`${idPrefix}-test`}
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <FlaskConical className="size-4" aria-hidden />
          {t("quizz:shortanswer.test")}
        </label>
        <input
          id={`${idPrefix}-test`}
          className={FIELD}
          placeholder={t("quizz:shortanswer.testPlaceholder")}
          aria-describedby={`${idPrefix}-test-result`}
          maxLength={INPUT_LENGTH}
          autoComplete="off"
          spellCheck={false}
          value={sample}
          onChange={(event) => setSample(event.target.value)}
        />
        <p
          id={`${idPrefix}-test-result`}
          aria-live="polite"
          className="text-sm break-words"
        >
          {renderTestResult()}
        </p>
      </div>
    </section>
  )
}

export default ShortAnswerEditor
