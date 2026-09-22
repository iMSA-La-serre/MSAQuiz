import { HIGHLIGHT_LIMITS } from "@razzia/common/constants"
import { highlightLength, parseHighlight } from "@razzia/common/utils/highlight"
import { countInputChars } from "@razzia/common/utils/text"
import AnswerChip from "@razzia/web/features/game/components/AnswerChip"
import { answerLetter } from "@razzia/web/features/game/utils/constants"
import HighlightPicker from "@razzia/web/features/questions/highlight/components/HighlightPicker"
import {
  remapSolutions,
  unwrapPassage,
  wrapSelection,
} from "@razzia/web/features/questions/highlight/utils/passages"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Brackets, Eraser } from "lucide-react"
import {
  type KeyboardEvent,
  type SyntheticEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import { useTranslation } from "react-i18next"

const { MAX_PASSAGES, PASSAGE_LENGTH, RAW_LENGTH, TEXT_LENGTH } =
  HIGHLIGHT_LIMITS

const WHITE_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"

const FIELD =
  "border-muted-foreground/80 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary aria-invalid:border-danger w-full rounded-lg border bg-white px-3 py-2.5 text-base font-semibold outline-none focus:ring-2"

// The column headers' type.
const HEADING =
  "text-muted-foreground text-xs font-semibold tracking-[0.15em] uppercase"

// The columns of the choice editor: chip, passage, correct-answer box, and
// the button that takes the brackets out. Below sm the box and the button
// wrap to a second line.
const COLUMNS = "sm:grid-cols-[2rem_minmax(0,1fr)_8rem_2.25rem]"

const ROW = clsx(
  "grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 py-2.5",
  COLUMNS,
)

// The first problem of the text, worded as the validator refuses it.
const textIssue = (text: string): string | null => {
  const parsed = parseHighlight(text)
  const { passages } = parsed

  if (parsed.issue === "brackets") {
    return "errors:quizz.highlightBrackets"
  }

  if (parsed.issue === "emptyPassage") {
    return "errors:quizz.highlightPassageEmpty"
  }

  if (text.length > RAW_LENGTH || highlightLength(parsed) > TEXT_LENGTH) {
    return "errors:quizz.highlightTextTooLong"
  }

  if (passages.length > MAX_PASSAGES) {
    return "errors:quizz.highlightTooManyPassages"
  }

  if (passages.some((passage) => countInputChars(passage) > PASSAGE_LENGTH)) {
    return "errors:quizz.highlightPassageTooLong"
  }

  if (passages.some((passage, index) => passages.indexOf(passage) !== index)) {
    return "errors:quizz.highlightPassageDuplicate"
  }

  return null
}

// The text in one field, its passages between [brackets], then the passages
// in the rows of the choice editor, where the ones to spot are ticked. The
// dashed button sets the words selected in the field between brackets.
const HighlightEditor = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const idPrefix = useId()
  const field = useRef<HTMLTextAreaElement>(null)
  // Where the caret goes once a passage is set or taken out, the field
  // having its new text.
  const pendingCaret = useRef<number | null>(null)
  const [selection, setSelection] = useState<[number, number]>([0, 0])
  const text = currentQuestion.text ?? ""
  const { solutions } = currentQuestion
  const parsed = useMemo(() => parseHighlight(text), [text])
  const { passages } = parsed
  const length = highlightLength(parsed)
  const issue = textIssue(text)
  const wrapped = wrapSelection(text, ...selection)
  const canWrap = wrapped !== null && passages.length < MAX_PASSAGES

  useEffect(() => {
    const caret = pendingCaret.current

    if (caret === null) {
      return
    }

    pendingCaret.current = null
    field.current?.focus()
    field.current?.setSelectionRange(caret, caret)
  })

  const setText = (next: string) => {
    const nextPassages = parseHighlight(next).passages

    updateQuestion(currentIndex, {
      text: next,
      answers: nextPassages,
      solutions: remapSolutions(passages, solutions, nextPassages),
    })
  }

  const trackSelection = (event: SyntheticEvent<HTMLTextAreaElement>) => {
    const { selectionStart, selectionEnd } = event.currentTarget

    setSelection([selectionStart, selectionEnd])
  }

  // One paragraph: a line break would read as a space on every screen.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
    }
  }

  const wrap = () => {
    if (!wrapped || !canWrap) {
      return
    }

    pendingCaret.current = wrapped.caret
    setSelection([wrapped.caret, wrapped.caret])
    setText(wrapped.text)
  }

  // The row goes with its passage: focus goes back to the field.
  const unwrap = (index: number) => {
    const unwrapped = unwrapPassage(text, index)

    if (!unwrapped) {
      return
    }

    pendingCaret.current = unwrapped.caret
    setSelection([unwrapped.caret, unwrapped.caret])
    setText(unwrapped.text)
  }

  return (
    <section
      aria-labelledby={`${idPrefix}-title`}
      className="bg-background text-foreground z-10 rounded-2xl p-4 shadow-sm md:p-6"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-3">
          <h3 id={`${idPrefix}-title`} className="text-lg font-bold">
            {t("quizz:highlight.title")}
          </h3>
          <span className="text-muted-foreground text-sm font-semibold tabular-nums">
            {t("quizz:answers.count", {
              count: passages.length,
              max: MAX_PASSAGES,
            })}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          {t("quizz:answers.hint.highlight")}
        </p>
      </header>

      <label
        htmlFor={`${idPrefix}-text`}
        className={clsx("block px-1 pb-2", HEADING)}
      >
        {t("quizz:highlight.columnText")}
      </label>
      <textarea
        ref={field}
        id={`${idPrefix}-text`}
        className={clsx(FIELD, "min-h-28 resize-y leading-relaxed")}
        rows={4}
        placeholder={t("quizz:highlight.placeholder")}
        aria-invalid={issue !== null}
        aria-describedby={`${idPrefix}-note`}
        maxLength={RAW_LENGTH}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onSelect={trackSelection}
        onKeyDown={handleKeyDown}
      />
      <p id={`${idPrefix}-note`} className="mt-1 px-1 text-xs break-words">
        <span
          className={clsx(
            "tabular-nums",
            length > TEXT_LENGTH
              ? "text-danger font-semibold"
              : "text-muted-foreground",
          )}
        >
          {t("quizz:highlight.counter", { count: length, max: TEXT_LENGTH })}
        </span>
        {issue && (
          <span className="text-danger block font-semibold">{t(issue)}</span>
        )}
      </p>

      <div
        aria-hidden
        className={clsx(
          "mt-4 hidden gap-x-3 px-1 pb-2 sm:grid",
          HEADING,
          COLUMNS,
        )}
      >
        <span />
        <span>{t("quizz:highlight.columnPassage")}</span>
        <span className="text-center">{t("quizz:answers.columnCorrect")}</span>
        <span />
      </div>

      {passages.length === 0 ? (
        <p className="text-muted-foreground border-muted mt-4 border-t py-3 text-sm sm:mt-0">
          {t("quizz:highlight.empty")}
        </p>
      ) : (
        <ol className="divide-muted flex flex-col divide-y">
          {passages.map((passage, index) => {
            const letter = answerLetter(index)

            return (
              <li key={index} className={ROW}>
                <AnswerChip index={index} size="sm" />
                <span className="border-muted-foreground/80 bg-muted text-foreground w-full rounded-lg border px-3 py-2.5 text-base font-semibold break-words">
                  {passage}
                </span>
                <div className="col-span-2 flex items-center justify-end gap-3 sm:contents">
                  {/* A label, so a tap on the visible « Bonne réponse » below
                  sm toggles the box too. */}
                  <label className="flex cursor-pointer items-center justify-center gap-2">
                    <span
                      aria-hidden
                      className="text-muted-foreground text-xs font-semibold sm:hidden"
                    >
                      {t("quizz:answers.columnCorrect")}
                    </span>
                    <HighlightPicker
                      index={index}
                      isSelected={solutions.includes(index)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => unwrap(index)}
                    aria-label={t("quizz:highlight.unwrap", {
                      letter,
                      passage,
                    })}
                    className={clsx(
                      "text-muted-foreground hover:bg-danger-subtle hover:text-danger flex size-11 items-center justify-center rounded-lg sm:size-9",
                      WHITE_FOCUS,
                    )}
                  >
                    <Eraser className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {passages.length > 0 && solutions.length === 0 && (
        <p className="text-muted-foreground mt-1 px-1 text-xs">
          {t("errors:quizz.highlightNoSolution")}
        </p>
      )}

      {/* Pressed without leaving the selection: the field keeps it. */}
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={wrap}
        disabled={!canWrap}
        className={clsx(
          "border-accent text-muted-foreground enabled:hover:border-primary enabled:hover:text-foreground mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-sm font-semibold disabled:opacity-40",
          WHITE_FOCUS,
        )}
      >
        <Brackets className="size-4" aria-hidden />
        {t("quizz:highlight.wrap")}
      </button>
    </section>
  )
}

export default HighlightEditor
