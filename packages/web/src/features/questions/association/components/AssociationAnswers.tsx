import AnswerRow, {
  AnswerReveal,
  isCompactList,
} from "@razzia/web/features/game/components/question/AnswerRow"
import SubmitAnswer from "@razzia/web/features/game/components/question/SubmitAnswer"
import { answerLetter } from "@razzia/web/features/game/utils/constants"
import type { AnswerComponentProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { useReducedMotion } from "motion/react"
import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

// Beyond this many characters in any item, host rows use smaller text.
const DENSE_LENGTH = 60

interface TargetsProps {
  name: string
  // The group's accessible name: the item's letter and words.
  label: string
  targets: string[]
  picked: number | null
  disabled: boolean
  onPick: (_target: number) => void
}

// The targets of one item, under its letter and words, across the row: native
// radio buttons, hidden, whose labels are the buttons. Tinted, outlined in
// green once picked, as a highlight's passages; 44 px tall. Two targets share
// the line, three too, four take two lines of two. A category longer than its
// column breaks inside the button rather than running over it: `break-words`
// alone would not, a single word being as wide as a flex item can get.
const TargetGroup = ({
  name,
  label,
  targets,
  picked,
  disabled,
  onPick,
}: TargetsProps) => (
  <span
    role="radiogroup"
    aria-label={label}
    className={clsx(
      "grid gap-2",
      targets.length === 3 ? "grid-cols-3" : "grid-cols-2",
    )}
  >
    {targets.map((target, index) => (
      <label
        key={index}
        className={clsx(
          "ease-out-quart has-focus-visible:outline-serre-yellow relative flex min-h-11 cursor-pointer items-center justify-center rounded-xl px-2 py-1.5 text-center text-base leading-tight font-semibold transition-[background-color,box-shadow] duration-300 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-disabled:cursor-default motion-reduce:transition-none",
          picked === index
            ? "bg-primary/15 ring-primary ring-2 ring-inset"
            : "bg-secondary/10 active:bg-secondary/20",
        )}
      >
        {/* A radio reached with Tab scrolls into view with the row below,
        or « Valider ». */}
        <input
          type="radio"
          className="sr-only scroll-mb-28"
          name={name}
          value={index}
          checked={picked === index}
          disabled={disabled}
          onChange={() => {
            onPick(index)
          }}
        />
        <span className="min-w-0 [overflow-wrap:anywhere]">{target}</span>
      </label>
    ))}
  </span>
)

interface Props extends AnswerComponentProps {
  // I18n key of the help line under « Valider » until every item is matched.
  emptyKey: string
}

// Statements and categorize: the rows of a multiple choice, one per item,
// each with its targets under its words (Vrai and Faux, or the categories).
// One « Valider » sends them all once every item has one, as an ordering
// once every item has its number. The projector shows the items only.
const AssociationAnswers = ({
  answers,
  targets = [],
  onSubmit,
  readOnly,
  locked = false,
  size,
  emptyKey,
}: Props) => {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const groupId = useId()
  const [picks, setPicks] = useState<Array<number | null>>(() =>
    answers.map(() => null),
  )
  const [submitted, setSubmitted] = useState(false)
  const submitBlock = useRef<HTMLDivElement>(null)
  const count = picks.filter((pick) => pick !== null).length
  const complete = answers.length > 0 && count === answers.length
  const frozen = locked || submitted
  const dense = answers.some((answer) => answer.length > DENSE_LENGTH)
  // Five items on the projector: compact rows, as the distribution.
  const compact = size === "host" && isCompactList(answers.length)

  // Four or five rows push « Valider » under a phone's fold: once every item
  // has its target, the button scrolls into view.
  useEffect(() => {
    if (!complete) {
      return
    }

    submitBlock.current?.scrollIntoView({
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    })
  }, [complete, reduceMotion])

  const pick = (item: number) => (target: number) => {
    if (frozen) {
      return
    }

    setPicks((prev) =>
      prev.map((current, i) => (i === item ? target : current)),
    )
  }

  const handleSubmit = () => {
    if (frozen || !complete) {
      return
    }

    setSubmitted(true)
    onSubmit({ answerKeys: picks.map((target) => target ?? 0) })
  }

  return (
    <>
      <ol
        className={clsx("flex flex-col", {
          "gap-2": size === "phone" || compact,
          "short:gap-2 gap-3 xl:gap-4": size === "host" && !compact,
        })}
      >
        {answers.map((item, index) => (
          <AnswerReveal key={index} index={index}>
            {readOnly ? (
              <AnswerRow
                index={index}
                text={item}
                size={size}
                locked={locked}
                dense={dense}
                compact={compact}
              />
            ) : (
              <AnswerRow
                index={index}
                text={item}
                size={size}
                locked={locked}
                outlined={picks[index] !== null}
                below={
                  <TargetGroup
                    name={`${groupId}-${index}`}
                    label={t("game:association.groupLabel", {
                      letter: answerLetter(index),
                      item,
                    })}
                    targets={targets}
                    picked={picks[index]}
                    disabled={frozen}
                    onPick={pick(index)}
                  />
                }
              />
            )}
          </AnswerReveal>
        ))}
      </ol>

      {!readOnly && (
        <>
          <p aria-live="polite" className="sr-only">
            {complete && !submitted ? t("game:association.complete") : ""}
          </p>
          <SubmitAnswer
            ref={submitBlock}
            index={answers.length}
            disabled={frozen || !complete}
            onClick={handleSubmit}
            count={count}
            countPending={!complete}
            help={!locked && !complete ? t(emptyKey) : ""}
          />
        </>
      )}
    </>
  )
}

export default AssociationAnswers
