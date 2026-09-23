import { QUESTION_TYPE_META, QUESTION_TYPES } from "@razzia/common/constants"
import type { QuestionType } from "@razzia/common/types/game"
import AnswerChip from "@razzia/web/features/game/components/AnswerChip"
import { ANSWERS_LABELS } from "@razzia/web/features/game/utils/constants"
import { QUESTION_REGISTRY } from "@razzia/web/features/questions"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Plus, Presentation, Trash2 } from "lucide-react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

const MIN_ANSWERS = 2

const MAX_ANSWERS = 4

const HINT_KEYS: Record<QuestionType, string> = {
  single: "quizz:answers.hint.single",
  multi: "quizz:answers.hint.multi",
  truefalse: "quizz:answers.hint.truefalse",
  poll: "quizz:answers.hint.poll",
  // Slides render the no-answers panel instead of the card.
  slide: "quizz:slideNoAnswers",
  // Shown by their own answers editor (QUESTION_REGISTRY.AnswersEditor).
  ordering: "quizz:answers.hint.ordering",
  shortanswer: "quizz:answers.hint.shortanswer",
  wordcloud: "quizz:answers.hint.wordcloud",
  estimate: "quizz:answers.hint.estimate",
  highlight: "quizz:answers.hint.highlight",
  statements: "quizz:answers.hint.statements",
  categorize: "quizz:answers.hint.categorize",
  ranking: "quizz:answers.hint.ranking",
  scale: "quizz:answers.hint.scale",
  markers: "quizz:answers.hint.markers",
}

// Chip, field, correct-answer box, delete button. Below sm the rows use two
// columns and the box and the delete button wrap to a second line.
const COLUMNS = {
  scored: "sm:grid-cols-[2rem_minmax(0,1fr)_8rem_2.25rem]",
  poll: "sm:grid-cols-[2rem_minmax(0,1fr)_2.25rem]",
  fixed: "sm:grid-cols-[2rem_minmax(0,1fr)_8rem]",
}

const WHITE_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"

const QuestionEditorAnswers = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
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

  const questionType = currentQuestion.type
  const { SolutionPicker, AnswersEditor } = QUESTION_REGISTRY[questionType]
  const { acceptsAnswers, answersCount, scored } =
    QUESTION_TYPE_META[questionType]
  // Types with a fixed set of answers (true/false) only let the author pick
  // which one is correct.
  const hasFixedAnswers = answersCount !== undefined
  const isRadioGroup = questionType === QUESTION_TYPES.TRUEFALSE

  // Types not answered by picking choices bring their own block. Keyed by
  // question, so nothing typed in it carries over to the next one.
  if (AnswersEditor) {
    return <AnswersEditor key={currentQuestion.id} />
  }

  if (!acceptsAnswers) {
    return (
      <div className="bg-background text-muted-foreground z-10 flex items-center gap-3 rounded-2xl p-6 text-sm font-medium shadow-sm">
        <Presentation className="size-6 shrink-0" aria-hidden />
        <p>{t("quizz:slideNoAnswers")}</p>
      </div>
    )
  }

  const { answers, solutions } = currentQuestion
  const canAdd = answers.length < MAX_ANSWERS
  const canRemove = answers.length > MIN_ANSWERS

  let columns = COLUMNS.poll

  if (hasFixedAnswers) {
    columns = COLUMNS.fixed
  } else if (scored) {
    columns = COLUMNS.scored
  }

  const updateAnswer = (index: number, value: string) => {
    const next = [...answers]
    next[index] = value
    updateQuestion(currentIndex, { answers: next })
  }

  const addAnswer = () => {
    if (!canAdd) {
      return
    }

    pendingFocus.current = answers.length
    updateQuestion(currentIndex, { answers: [...answers, ""] })
  }

  const removeAnswer = (index: number) => {
    if (!canRemove) {
      return
    }

    const nextAnswers = answers.filter((_, i) => i !== index)
    const nextSolutions = solutions
      .filter((s) => s !== index)
      .map((s) => (s > index ? s - 1 : s))
    const fallback = scored ? [0] : []

    pendingFocus.current = index
    updateQuestion(currentIndex, {
      answers: nextAnswers,
      solutions: nextSolutions.length > 0 ? nextSolutions : fallback,
    })
  }

  const rowClassName = clsx(
    "grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 py-2.5",
    columns,
  )

  const renderCells = (answer: string, index: number) => {
    const letter = ANSWERS_LABELS[index]

    return (
      <>
        <AnswerChip index={index} size="sm" />
        <input
          ref={(element) => {
            inputs.current[index] = element
          }}
          className="border-muted-foreground/80 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary read-only:bg-muted w-full rounded-lg border bg-white px-3 py-2.5 text-base font-semibold outline-none focus:ring-2"
          placeholder={t("quizz:answers.placeholder", { letter })}
          aria-label={t("quizz:answers.placeholder", { letter })}
          value={answer}
          readOnly={hasFixedAnswers}
          onChange={(event) => updateAnswer(index, event.target.value)}
        />
        <div className="col-span-2 flex items-center justify-end gap-3 sm:contents">
          {scored && (
            // A label, so a tap on the visible « Bonne réponse » below sm
            // toggles the box too.
            <label className="flex cursor-pointer items-center justify-center gap-2">
              <span
                aria-hidden
                className="text-muted-foreground text-xs font-semibold sm:hidden"
              >
                {t("quizz:answers.columnCorrect")}
              </span>
              <SolutionPicker
                index={index}
                isSelected={solutions.includes(index)}
              />
            </label>
          )}
          {!hasFixedAnswers && (
            <button
              type="button"
              onClick={() => removeAnswer(index)}
              disabled={!canRemove}
              aria-label={t("quizz:answers.remove", { letter })}
              className={clsx(
                "text-muted-foreground enabled:hover:bg-danger-subtle enabled:hover:text-danger flex size-11 items-center justify-center rounded-lg disabled:opacity-40 sm:size-9",
                WHITE_FOCUS,
              )}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </>
    )
  }

  return (
    <section
      aria-labelledby="answers-title"
      className="bg-background text-foreground z-10 rounded-2xl p-4 shadow-sm md:p-6"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-3">
          <h3 id="answers-title" className="text-lg font-bold">
            {t("quizz:answers.title")}
          </h3>
          <span className="text-muted-foreground text-sm font-semibold tabular-nums">
            {t("quizz:answers.count", {
              count: answers.length,
              max: MAX_ANSWERS,
            })}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          {t(HINT_KEYS[questionType])}
        </p>
      </header>

      <div
        aria-hidden
        className={clsx(
          "text-muted-foreground hidden gap-x-3 px-1 pb-2 text-xs font-semibold tracking-[0.15em] uppercase sm:grid",
          columns,
        )}
      >
        <span />
        <span>{t("quizz:answers.columnAnswer")}</span>
        {scored && (
          <span className="text-center">
            {t("quizz:answers.columnCorrect")}
          </span>
        )}
        {!hasFixedAnswers && <span />}
      </div>

      {isRadioGroup ? (
        // A radiogroup cannot own list items, so true/false uses plain rows.
        <div
          role="radiogroup"
          aria-label={t("quizz:answers.columnCorrect")}
          className="divide-muted flex flex-col divide-y"
        >
          {answers.map((answer, index) => (
            <div key={index} className={rowClassName}>
              {renderCells(answer, index)}
            </div>
          ))}
        </div>
      ) : (
        <ol className="divide-muted flex flex-col divide-y">
          {answers.map((answer, index) => (
            <li key={index} className={rowClassName}>
              {renderCells(answer, index)}
            </li>
          ))}
        </ol>
      )}

      {!hasFixedAnswers && (
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
          {t("quizz:answers.add")}
        </button>
      )}
    </section>
  )
}

export default QuestionEditorAnswers
