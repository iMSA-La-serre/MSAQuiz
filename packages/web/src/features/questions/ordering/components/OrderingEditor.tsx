import {
  ORDERING_ITEM_MAX_LENGTH,
  QUESTION_TYPE_META,
} from "@razzia/common/constants"
import { Chip } from "@razzia/web/features/game/components/AnswerChip"
import { duplicatesOf } from "@razzia/web/features/questions/keys"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

const { minAnswers: MIN_ITEMS, maxAnswers: MAX_ITEMS } =
  QUESTION_TYPE_META.ordering

type Control = "input" | "up" | "down"

const WHITE_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"

const ICON_BUTTON = clsx(
  "text-muted-foreground flex size-11 items-center justify-center rounded-lg disabled:opacity-40 sm:size-9",
  WHITE_FOCUS,
)

// The columns of the choice editor: chip, field, then the moves where the
// choices have their correct-answer box, and delete. Below sm the buttons wrap
// to a second line.
const COLUMNS = "sm:grid-cols-[2rem_minmax(0,1fr)_8rem_2.25rem]"

const ROW = clsx(
  "grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 py-2.5",
  COLUMNS,
)

// The author types the items in the correct order; the server shuffles them
// for the players. Moving an item uses buttons, which work with a keyboard.
const OrderingEditor = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const duplicateId = useId()
  const items = currentQuestion.answers
  const controls = useRef<Record<Control, Array<HTMLElement | null>>>({
    input: [],
    up: [],
    down: [],
  })
  const addButton = useRef<HTMLButtonElement>(null)
  // Control that gets focus after an add, a delete or a move. When it no
  // longer exists or is disabled, focus goes to the field of that row, then
  // to the add button.
  const pendingFocus = useRef<{ index: number; control: Control } | null>(null)
  const [announcement, setAnnouncement] = useState("")

  useEffect(() => {
    const target = pendingFocus.current

    if (target === null) {
      return
    }

    pendingFocus.current = null
    const control = controls.current[target.control][target.index]
    const input = controls.current.input[target.index]

    if (control && !control.hasAttribute("disabled")) {
      control.focus()

      return
    }

    if (input) {
      input.focus()

      return
    }

    addButton.current?.focus()
  })

  const canAdd = items.length < MAX_ITEMS
  const canRemove = items.length > MIN_ITEMS
  const duplicates = duplicatesOf(items)

  const setItems = (next: string[]) => {
    updateQuestion(currentIndex, { answers: next })
  }

  const updateItem = (index: number, value: string) => {
    setItems(items.map((item, i) => (i === index ? value : item)))
  }

  const addItem = () => {
    if (!canAdd) {
      return
    }

    pendingFocus.current = { index: items.length, control: "input" }
    setItems([...items, ""])
  }

  const removeItem = (index: number) => {
    if (!canRemove) {
      return
    }

    pendingFocus.current = { index, control: "input" }
    setItems(items.filter((_, i) => i !== index))
  }

  const moveItem = (index: number, offset: -1 | 1) => {
    const target = index + offset

    if (target < 0 || target >= items.length) {
      return
    }

    const next = [...items]
    next[index] = items[target]
    next[target] = items[index]

    pendingFocus.current = {
      index: target,
      control: offset < 0 ? "up" : "down",
    }
    setItems(next)
    setAnnouncement(
      t("quizz:ordering.moved", {
        item:
          items[index].trim() ||
          t("quizz:ordering.placeholder", { number: index + 1 }),
        position: target + 1,
      }),
    )
  }

  const register =
    (control: Control, index: number) => (element: HTMLElement | null) => {
      controls.current[control][index] = element
    }

  return (
    <section
      aria-labelledby="ordering-title"
      className="bg-background text-foreground z-10 rounded-2xl p-4 shadow-sm md:p-6"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-3">
          <h3 id="ordering-title" className="text-lg font-bold">
            {t("quizz:ordering.title")}
          </h3>
          <span className="text-muted-foreground text-sm font-semibold tabular-nums">
            {t("quizz:answers.count", { count: items.length, max: MAX_ITEMS })}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          {t("quizz:answers.hint.ordering")}
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
        <span>{t("quizz:ordering.columnItem")}</span>
        <span className="text-center">
          {t("quizz:ordering.columnPosition")}
        </span>
        <span />
      </div>

      <ol className="divide-muted flex flex-col divide-y">
        {items.map((item, index) => {
          const number = index + 1
          const isDuplicate = duplicates.has(index)

          return (
            <li key={index} className={ROW}>
              {/* The letter chip's box, neutral: letters stand for the
              shuffled list the players see, numbers for the correct order. */}
              <Chip
                aria-hidden
                size="sm"
                className="bg-muted text-secondary tabular-nums"
              >
                {number}
              </Chip>
              <input
                ref={register("input", index)}
                className="border-muted-foreground/80 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary aria-invalid:border-danger w-full rounded-lg border bg-white px-3 py-2.5 text-base font-semibold outline-none focus:ring-2"
                placeholder={t("quizz:ordering.placeholder", { number })}
                aria-label={t("quizz:ordering.placeholder", { number })}
                aria-invalid={isDuplicate}
                aria-describedby={isDuplicate ? duplicateId : undefined}
                maxLength={ORDERING_ITEM_MAX_LENGTH}
                value={item}
                onChange={(event) => updateItem(index, event.target.value)}
              />
              <div className="col-span-2 flex items-center justify-end gap-3 sm:contents">
                <div className="flex items-center justify-center gap-1">
                  <button
                    ref={register("up", index)}
                    type="button"
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0}
                    aria-label={t("quizz:ordering.moveUp", { number })}
                    className={clsx(
                      ICON_BUTTON,
                      "enabled:hover:bg-muted enabled:hover:text-foreground",
                    )}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button
                    ref={register("down", index)}
                    type="button"
                    onClick={() => moveItem(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label={t("quizz:ordering.moveDown", { number })}
                    className={clsx(
                      ICON_BUTTON,
                      "enabled:hover:bg-muted enabled:hover:text-foreground",
                    )}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={!canRemove}
                  aria-label={t("quizz:ordering.remove", { number })}
                  className={clsx(
                    ICON_BUTTON,
                    "enabled:hover:bg-danger-subtle enabled:hover:text-danger",
                  )}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          )
        })}
      </ol>

      {duplicates.size > 0 && (
        <p id={duplicateId} className="text-danger mt-2 text-sm font-semibold">
          {t("errors:quizz.orderItemDuplicate")}
        </p>
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <button
        ref={addButton}
        type="button"
        onClick={addItem}
        disabled={!canAdd}
        className={clsx(
          "border-accent text-muted-foreground enabled:hover:border-primary enabled:hover:text-foreground mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-sm font-semibold disabled:opacity-40",
          WHITE_FOCUS,
        )}
      >
        <Plus className="size-4" aria-hidden />
        {t("quizz:ordering.add")}
      </button>
    </section>
  )
}

export default OrderingEditor
