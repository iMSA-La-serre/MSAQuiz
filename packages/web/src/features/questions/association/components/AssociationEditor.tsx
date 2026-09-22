import { ASSOCIATION_LIMITS, QUESTION_TYPES } from "@razzia/common/constants"
import { targetsOf } from "@razzia/common/utils/association"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@razzia/web/components/Select"
import AnswerChip, {
  Chip,
} from "@razzia/web/features/game/components/AnswerChip"
import { answerLetter } from "@razzia/web/features/game/utils/constants"
import {
  alignedTargets,
  UNSET,
  withItem,
  withoutCategory,
  withoutItem,
  withTarget,
} from "@razzia/web/features/questions/association/utils/draft"
import { duplicatesOf } from "@razzia/web/features/questions/keys"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Plus, Tag, Trash2 } from "lucide-react"
import { type ReactNode, useEffect, useId, useRef } from "react"
import { useTranslation } from "react-i18next"

const { MAX_ITEMS, MIN_ITEMS, MAX_TARGETS, MIN_TARGETS, ITEM_LENGTH } =
  ASSOCIATION_LIMITS

const WHITE_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"

const FIELD =
  "border-muted-foreground/80 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary aria-invalid:border-danger w-full rounded-lg border bg-white px-3 py-2.5 text-base font-semibold outline-none focus:ring-2"

const HEADING =
  "text-muted-foreground text-xs font-semibold tracking-[0.15em] uppercase"

const CARD =
  "bg-background text-foreground z-10 rounded-2xl p-4 shadow-sm md:p-6"

const ICON_BUTTON = clsx(
  "text-muted-foreground enabled:hover:bg-danger-subtle enabled:hover:text-danger flex size-11 items-center justify-center rounded-lg disabled:opacity-40 sm:size-9",
  WHITE_FOCUS,
)

const ADD_BUTTON = clsx(
  "border-accent text-muted-foreground enabled:hover:border-primary enabled:hover:text-foreground mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-sm font-semibold disabled:opacity-40",
  WHITE_FOCUS,
)

// The columns of the choice editor: chip, field, the right target where a
// choice has its correct-answer box (wider for a category's name), delete.
// Below sm the target and the button wrap to a second line.
const ITEM_COLUMNS = {
  statements: "sm:grid-cols-[2rem_minmax(0,1fr)_8rem_2.25rem]",
  categorize: "sm:grid-cols-[2rem_minmax(0,1fr)_11rem_2.25rem]",
}

// The columns of the poll editor: chip, field, delete.
const CATEGORY_COLUMNS = "sm:grid-cols-[2rem_minmax(0,1fr)_2.25rem]"

const rowClass = (columns: string) =>
  clsx(
    "grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 py-2.5",
    columns,
  )

interface BlockHeaderProps {
  id: string
  title: string
  count: number
  max: number
  hint: string
}

// The header of the choice editor: title, « n sur m », hint on the right.
const BlockHeader = ({ id, title, count, max, hint }: BlockHeaderProps) => {
  const { t } = useTranslation()

  return (
    <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div className="flex items-baseline gap-3">
        <h3 id={id} className="text-lg font-bold">
          {title}
        </h3>
        <span className="text-muted-foreground text-sm font-semibold tabular-nums">
          {t("quizz:answers.count", { count, max })}
        </span>
      </div>
      <p className="text-muted-foreground text-sm">{hint}</p>
    </header>
  )
}

interface VerdictProps {
  name: string
  label: string
  targets: string[]
  picked: number
  onPick: (_target: number) => void
}

// Vrai or Faux for one statement: native radio buttons, hidden, whose labels
// are two small buttons in the correct-answer column, tinted and outlined
// once picked, as on the phone. Focus draws an outline rather than a ring:
// tabbing into a group lands on the button already picked, whose ring is
// inset and would swallow another one.
const VerdictPicker = ({
  name,
  label,
  targets,
  picked,
  onPick,
}: VerdictProps) => (
  <span role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-1">
    {targets.map((target, index) => (
      <label
        key={index}
        className={clsx(
          "has-focus-visible:outline-primary relative flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 sm:min-h-9",
          picked === index
            ? "bg-primary/15 ring-primary text-foreground ring-2 ring-inset"
            : "bg-muted text-muted-foreground hover:text-foreground",
        )}
      >
        <input
          type="radio"
          className="sr-only"
          name={name}
          value={index}
          checked={picked === index}
          onChange={() => {
            onPick(index)
          }}
        />
        {target}
      </label>
    ))}
  </span>
)

// Statements and categorize: the items in the rows of the choice editor, each
// with its right target where a choice has its correct-answer box, Vrai or
// Faux for a statement, a category for an element to sort. A categorize
// question first lists its categories, as a poll lists its answers.
const AssociationEditor = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const idPrefix = useId()
  const itemDuplicateId = useId()
  const categoryDuplicateId = useId()
  const isStatements = currentQuestion.type === QUESTION_TYPES.STATEMENTS
  const kind = isStatements ? "statements" : "categorize"
  const items = currentQuestion.answers
  const targets = isStatements
    ? targetsOf(currentQuestion)
    : (currentQuestion.targets ?? [])
  const expected = alignedTargets(currentQuestion.expectedTargets, items.length)
  const itemInputs = useRef<Array<HTMLInputElement | null>>([])
  const categoryInputs = useRef<Array<HTMLInputElement | null>>([])
  const addItemButton = useRef<HTMLButtonElement>(null)
  const addCategoryButton = useRef<HTMLButtonElement>(null)
  // Field that gets focus after an add or a delete. When that row no longer
  // exists, focus goes to the add button of its block.
  const pendingFocus = useRef<{
    block: "item" | "category"
    index: number
  } | null>(null)

  useEffect(() => {
    const target = pendingFocus.current

    if (target === null) {
      return
    }

    pendingFocus.current = null

    const isItem = target.block === "item"
    const input = (isItem ? itemInputs : categoryInputs).current[target.index]

    if (input) {
      input.focus()

      return
    }

    const addButton = isItem ? addItemButton : addCategoryButton

    addButton.current?.focus()
  })

  const itemDuplicates = duplicatesOf(items)
  const categoryDuplicates = duplicatesOf(targets)
  const unmatched = expected.some(
    (target) => target === UNSET || target >= targets.length,
  )

  const updateItem = (index: number, value: string) => {
    updateQuestion(currentIndex, {
      answers: items.map((item, i) => (i === index ? value : item)),
    })
  }

  const addItem = () => {
    if (items.length >= MAX_ITEMS) {
      return
    }

    pendingFocus.current = { block: "item", index: items.length }
    updateQuestion(
      currentIndex,
      withItem(items, currentQuestion.expectedTargets),
    )
  }

  const removeItem = (index: number) => {
    if (items.length <= MIN_ITEMS) {
      return
    }

    pendingFocus.current = { block: "item", index }
    updateQuestion(
      currentIndex,
      withoutItem(items, currentQuestion.expectedTargets, index),
    )
  }

  const pickTarget = (index: number) => (target: number) => {
    updateQuestion(currentIndex, {
      expectedTargets: withTarget(expected, index, target),
    })
  }

  const updateCategory = (index: number, value: string) => {
    updateQuestion(currentIndex, {
      targets: targets.map((target, i) => (i === index ? value : target)),
    })
  }

  const addCategory = () => {
    if (targets.length >= MAX_TARGETS) {
      return
    }

    pendingFocus.current = { block: "category", index: targets.length }
    updateQuestion(currentIndex, { targets: [...targets, ""] })
  }

  const removeCategory = (index: number) => {
    if (targets.length <= MIN_TARGETS) {
      return
    }

    pendingFocus.current = { block: "category", index }
    updateQuestion(currentIndex, withoutCategory(targets, expected, index))
  }

  const categoryName = (index: number) => {
    const name = targets.at(index)?.trim() ?? ""

    return name === ""
      ? t("quizz:categorize.categoryPlaceholder", { number: index + 1 })
      : name
  }

  const renderTarget = (index: number, letter: string): ReactNode => {
    if (isStatements) {
      return (
        <VerdictPicker
          name={`${idPrefix}-verdict-${index}`}
          label={t("quizz:statements.verdictLabel", { letter })}
          targets={targets}
          picked={expected[index]}
          onPick={pickTarget(index)}
        />
      )
    }

    const picked = expected[index]

    return (
      <Select
        value={picked >= 0 && picked < targets.length ? String(picked) : ""}
        onValueChange={(value) => {
          pickTarget(index)(Number(value))
        }}
      >
        <SelectTrigger
          className="min-h-11 sm:min-h-0"
          aria-label={t("quizz:categorize.pickLabel", { letter })}
        >
          <SelectValue placeholder={t("quizz:categorize.pick")} />
        </SelectTrigger>
        <SelectContent>
          {targets.map((_, target) => (
            <SelectItem key={target} value={String(target)}>
              {categoryName(target)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  const categories = !isStatements && (
    <section aria-labelledby={`${idPrefix}-categories`} className={CARD}>
      <BlockHeader
        id={`${idPrefix}-categories`}
        title={t("quizz:categorize.categoriesTitle")}
        count={targets.length}
        max={MAX_TARGETS}
        hint={t("quizz:categorize.categoriesHint")}
      />

      <div
        aria-hidden
        className={clsx(
          "hidden gap-x-3 px-1 pb-2 sm:grid",
          HEADING,
          CATEGORY_COLUMNS,
        )}
      >
        <span />
        <span>{t("quizz:categorize.columnCategory")}</span>
        <span />
      </div>

      <ol className="divide-muted flex flex-col divide-y">
        {targets.map((target, index) => {
          const number = index + 1

          return (
            <li
              key={index}
              className={clsx(
                "grid grid-cols-[2rem_minmax(0,1fr)_2.75rem] items-center gap-x-3 py-2.5",
                CATEGORY_COLUMNS,
              )}
            >
              {/* The letter chip's box, neutral: letters stand for the
              items. */}
              <Chip aria-hidden size="sm" className="bg-muted text-secondary">
                <Tag className="size-4" />
              </Chip>
              <input
                ref={(element) => {
                  categoryInputs.current[index] = element
                }}
                className={FIELD}
                placeholder={t("quizz:categorize.categoryPlaceholder", {
                  number,
                })}
                aria-label={t("quizz:categorize.categoryPlaceholder", {
                  number,
                })}
                aria-invalid={categoryDuplicates.has(index)}
                aria-describedby={
                  categoryDuplicates.has(index)
                    ? categoryDuplicateId
                    : undefined
                }
                maxLength={ASSOCIATION_LIMITS.TARGET_LENGTH}
                value={target}
                onChange={(event) => {
                  updateCategory(index, event.target.value)
                }}
              />
              <button
                type="button"
                onClick={() => {
                  removeCategory(index)
                }}
                disabled={targets.length <= MIN_TARGETS}
                aria-label={t("quizz:categorize.removeCategory", { number })}
                className={ICON_BUTTON}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          )
        })}
      </ol>

      {categoryDuplicates.size > 0 && (
        <p
          id={categoryDuplicateId}
          className="text-danger mt-2 text-sm font-semibold"
        >
          {t("errors:quizz.categorizeTargetDuplicate")}
        </p>
      )}

      <button
        ref={addCategoryButton}
        type="button"
        onClick={addCategory}
        disabled={targets.length >= MAX_TARGETS}
        className={ADD_BUTTON}
      >
        <Plus className="size-4" aria-hidden />
        {t("quizz:categorize.addCategory")}
      </button>
    </section>
  )

  return (
    <>
      {categories}

      <section aria-labelledby={`${idPrefix}-items`} className={CARD}>
        <BlockHeader
          id={`${idPrefix}-items`}
          title={t(`quizz:${kind}.title`)}
          count={items.length}
          max={MAX_ITEMS}
          hint={t(`quizz:answers.hint.${kind}`)}
        />

        <div
          aria-hidden
          className={clsx(
            "hidden gap-x-3 px-1 pb-2 sm:grid",
            HEADING,
            ITEM_COLUMNS[kind],
          )}
        >
          <span />
          <span>{t(`quizz:${kind}.columnItem`)}</span>
          <span className="text-center">{t(`quizz:${kind}.columnTarget`)}</span>
          <span />
        </div>

        <ol className="divide-muted flex flex-col divide-y">
          {items.map((item, index) => {
            const letter = answerLetter(index)
            const isDuplicate = itemDuplicates.has(index)

            return (
              <li key={index} className={rowClass(ITEM_COLUMNS[kind])}>
                <AnswerChip index={index} size="sm" />
                <input
                  ref={(element) => {
                    itemInputs.current[index] = element
                  }}
                  className={FIELD}
                  placeholder={t(`quizz:${kind}.placeholder`, { letter })}
                  aria-label={t(`quizz:${kind}.placeholder`, { letter })}
                  aria-invalid={isDuplicate}
                  aria-describedby={isDuplicate ? itemDuplicateId : undefined}
                  maxLength={ITEM_LENGTH}
                  value={item}
                  onChange={(event) => {
                    updateItem(index, event.target.value)
                  }}
                />
                <div className="col-span-2 flex items-center justify-end gap-3 sm:contents">
                  <div className="min-w-0 flex-1 sm:flex-none">
                    {renderTarget(index, letter)}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      removeItem(index)
                    }}
                    disabled={items.length <= MIN_ITEMS}
                    aria-label={t(`quizz:${kind}.remove`, { letter })}
                    className={ICON_BUTTON}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            )
          })}
        </ol>

        {itemDuplicates.size > 0 && (
          <p
            id={itemDuplicateId}
            className="text-danger mt-2 text-sm font-semibold"
          >
            {t(
              isStatements
                ? "errors:quizz.statementDuplicate"
                : "errors:quizz.categorizeItemDuplicate",
            )}
          </p>
        )}

        {unmatched && (
          <p className="text-muted-foreground mt-1 px-1 text-xs">
            {t(
              isStatements
                ? "errors:quizz.statementUnanswered"
                : "errors:quizz.categorizeUnsorted",
            )}
          </p>
        )}

        <button
          ref={addItemButton}
          type="button"
          onClick={addItem}
          disabled={items.length >= MAX_ITEMS}
          className={ADD_BUTTON}
        >
          <Plus className="size-4" aria-hidden />
          {t(`quizz:${kind}.add`)}
        </button>
      </section>
    </>
  )
}

export default AssociationEditor
