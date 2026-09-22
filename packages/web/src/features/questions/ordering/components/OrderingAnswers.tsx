import AnswerRow, {
  AnswerReveal,
  isCompactList,
} from "@razzia/web/features/game/components/question/AnswerRow"
import SubmitAnswer from "@razzia/web/features/game/components/question/SubmitAnswer"
import TickBox from "@razzia/web/features/game/components/question/TickBox"
import { answerLetter } from "@razzia/web/features/game/utils/constants"
import {
  isComplete,
  positionOf,
  toggleItem,
} from "@razzia/web/features/questions/ordering/utils/sequence"
import {
  ANSWER_WORDING,
  type ListAnswerWords,
} from "@razzia/web/features/questions/ordering/utils/wording"
import type { AnswerComponentProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

// Beyond this many characters in any item, host rows use smaller text.
const DENSE_LENGTH = 60

// Ordering: the rows of a multiple choice, where each tap gives an item the
// next position and a second tap takes it back. No dragging: taps work alike
// with a thumb, a keyboard or a screen reader. The items come in the order the
// server shuffled them, lettered like choices.
interface Props extends AnswerComponentProps {
  // What the screen reader hears: a ranking numbers proposals by priority,
  // not items by position.
  words?: ListAnswerWords
}

const OrderingAnswers = ({
  answers,
  onSubmit,
  readOnly,
  locked = false,
  size,
  words = ANSWER_WORDING.ordering,
}: Props) => {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const [sequence, setSequence] = useState<number[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [announcement, setAnnouncement] = useState("")
  const submitBlock = useRef<HTMLDivElement>(null)
  const complete = isComplete(sequence, answers.length)
  const frozen = locked || submitted
  const dense = answers.some((answer) => answer.length > DENSE_LENGTH)
  // Five or six items on the projector: compact rows, as the distribution.
  const compact = size === "host" && isCompactList(answers.length)

  // Five or six rows can push « Valider » under a phone's fold: once every
  // item has its number, the button scrolls into view.
  useEffect(() => {
    if (!complete) {
      return
    }

    submitBlock.current?.scrollIntoView({
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    })
  }, [complete, reduceMotion])

  const handleTap = (key: number) => () => {
    if (frozen) {
      return
    }

    const next = toggleItem(sequence, key)
    const position = positionOf(next, key)
    const item = answers[key]

    setSequence(next)

    if (position === null) {
      setAnnouncement(t(words.removed, { item }))

      return
    }

    const placed = t(words.placed, { item, position })

    setAnnouncement(
      isComplete(next, answers.length)
        ? `${placed}. ${t(words.complete)}`
        : placed,
    )
  }

  const handleSubmit = () => {
    if (frozen || !complete) {
      return
    }

    setSubmitted(true)
    onSubmit({ answerKeys: sequence })
  }

  return (
    <>
      <ol
        className={clsx("flex flex-col", {
          "gap-2": size === "phone" || compact,
          "short:gap-2 gap-3 xl:gap-4": size === "host" && !compact,
        })}
      >
        {answers.map((item, key) => {
          const position = positionOf(sequence, key)

          return (
            <AnswerReveal key={key} index={key}>
              {readOnly ? (
                <AnswerRow
                  index={key}
                  text={item}
                  size={size}
                  locked={locked}
                  dense={dense}
                  compact={compact}
                />
              ) : (
                <AnswerRow
                  index={key}
                  text={item}
                  size={size}
                  locked={locked}
                  dense={dense}
                  interactive
                  aria-pressed={position !== null}
                  aria-label={
                    position === null
                      ? undefined
                      : t(words.itemLabel, {
                          letter: answerLetter(key),
                          item,
                          position,
                        })
                  }
                  outlined={position !== null}
                  disabled={submitted}
                  // A row reached with Tab scrolls into view with the next
                  // one, or « Valider », showing below it.
                  className="scroll-mb-28"
                  onClick={handleTap(key)}
                  trailing={
                    <TickBox checked={position !== null}>
                      <span className="text-base leading-none font-bold tabular-nums">
                        {position}
                      </span>
                    </TickBox>
                  }
                />
              )}
            </AnswerReveal>
          )
        })}
      </ol>

      {!readOnly && (
        <>
          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
          <SubmitAnswer
            ref={submitBlock}
            index={answers.length}
            disabled={frozen || !complete}
            onClick={handleSubmit}
            count={sequence.length}
            countPending={!complete}
            help={!locked && !complete ? t(words.empty) : ""}
          />
        </>
      )}
    </>
  )
}

export default OrderingAnswers
