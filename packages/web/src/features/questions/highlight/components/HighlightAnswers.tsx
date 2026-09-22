import { parseHighlight } from "@razzia/common/utils/highlight"
import AnswerChip from "@razzia/web/features/game/components/AnswerChip"
import { AnswerReveal } from "@razzia/web/features/game/components/question/AnswerRow"
import SubmitAnswer from "@razzia/web/features/game/components/question/SubmitAnswer"
import { answerLetter } from "@razzia/web/features/game/utils/constants"
import { splitFirstWord } from "@razzia/web/features/questions/highlight/utils/passages"
import type { AnswerComponentProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { useReducedMotion } from "motion/react"
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

// The answer row's shell, around a whole text: white card, navy text, shadow,
// dimmed during the reading time.
const CARD =
  "text-secondary ease-out-quart rounded-2xl text-left transition-[background-color,box-shadow] duration-300 motion-reduce:transition-none"

// The host row sizes, a little more open between lines for a paragraph: the
// longest text allowed still takes five or six lines on a 1280×650 projector.
const HOST_TEXT = "text-xl leading-[1.8] md:text-2xl xl:text-3xl short:text-2xl"

interface PassageProps {
  index: number
  text: string
}

// A passage on the projector: its letter chip, as in the distribution rows,
// and its words in bold on a tint a projector does not wash out. The chip
// keeps the first word on its line. Cut by a line break, the tint runs on
// as one band (box-decoration-break: slice, the default).
const HostPassage = ({ index, text }: PassageProps) => {
  const [first, rest] = splitFirstWord(text)

  return (
    <span className="bg-secondary/20 rounded-lg px-1.5 py-0.5 font-bold">
      <span className="whitespace-nowrap">
        <AnswerChip
          index={index}
          size="sm"
          className="short:size-7 short:text-lg mr-2"
        />
        {first}
      </span>
      {rest}
    </span>
  )
}

interface ToggleProps extends PassageProps {
  checked: boolean
  disabled: boolean
  onToggle: () => void
}

// A passage on the phone: a native checkbox, hidden, whose label is the
// passage in the flow of the text. A label wraps from one line to the next
// as the words do, where a button would move whole to the next line; cut by
// a line break, its tint and ring run on as one band (box-decoration-break:
// slice, the default). Tinted, outlined in green once ticked as a picked row
// is; its letter, in a small neutral badge, is the one the projector and the
// waiting screen show. A target inside a sentence is exempt from the 44 px
// rule (WCAG 2.5.5/2.5.8): taller padding would spread the whole paragraph
// apart, so each line of it is about 34 px, on a 36 px line height. The
// margin keeps its ring and focus outline off the punctuation next to it.
const PassageToggle = ({
  index,
  text,
  checked,
  disabled,
  onToggle,
}: ToggleProps) => {
  const { t } = useTranslation()
  const [first, rest] = splitFirstWord(text)

  return (
    <label
      className={clsx(
        "ease-out-quart has-focus-visible:outline-serre-yellow mx-0.5 cursor-pointer rounded-lg px-1 py-1.5 font-semibold transition-[background-color,box-shadow] duration-300 has-focus-visible:outline-2 has-focus-visible:outline-offset-0 has-disabled:cursor-default motion-reduce:transition-none",
        checked
          ? "bg-primary/15 ring-primary ring-2"
          : "bg-secondary/15 active:bg-secondary/25",
      )}
    >
      {/* Named apart from the label, whose badge runs into the first word
      (« Avotre employeur »). */}
      <input
        type="checkbox"
        className="sr-only"
        aria-label={t("game:answer.passageLabel", {
          letter: answerLetter(index),
          passage: text,
        })}
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
      />
      <span className="whitespace-nowrap">
        <span
          aria-hidden
          className={clsx(
            "mr-1.5 inline-flex size-5 items-center justify-center rounded-md align-[0.1em] text-xs leading-none font-bold",
            checked
              ? "bg-secondary text-white"
              : "text-secondary ring-secondary/30 bg-white ring-1 ring-inset",
          )}
        >
          {answerLetter(index)}
        </span>
        {first}
      </span>
      {rest}
    </label>
  )
}

// Highlight: the text in the answer row's card, its passages lettered. On
// the phone each passage is a checkbox, then one « Valider » sends them all,
// as a multiple choice does.
const HighlightAnswers = ({
  text = "",
  onSubmit,
  readOnly,
  locked = false,
}: AnswerComponentProps) => {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const { parts } = useMemo(() => parseHighlight(text), [text])
  const [selected, setSelected] = useState<number[]>([])
  const [submitted, setSubmitted] = useState(false)
  const submitBlock = useRef<HTMLDivElement>(null)
  const frozen = locked || submitted
  const hasSelection = selected.length > 0

  // A long text can push « Valider » under a phone's fold: once a first
  // passage is ticked, the button scrolls into view, as an ordering's does
  // once every item has its number.
  useEffect(() => {
    if (!hasSelection) {
      return
    }

    submitBlock.current?.scrollIntoView({
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    })
  }, [hasSelection, reduceMotion])

  const card = clsx(
    CARD,
    locked ? "bg-white/70 shadow-none" : "bg-white shadow-lg shadow-black/15",
  )

  if (readOnly) {
    return (
      <AnswerReveal index={0} as="div">
        <p
          className={clsx(
            card,
            "short:py-3 px-5 py-4 font-medium xl:px-6 xl:py-5",
            HOST_TEXT,
          )}
        >
          {parts.map((part, key) =>
            part.passage === undefined ? (
              <Fragment key={key}>{part.text}</Fragment>
            ) : (
              <HostPassage key={key} index={part.passage} text={part.text} />
            ),
          )}
        </p>
      </AnswerReveal>
    )
  }

  const toggle = (passage: number) => () => {
    if (frozen) {
      return
    }

    setSelected((prev) =>
      prev.includes(passage)
        ? prev.filter((id) => id !== passage)
        : [...prev, passage],
    )
  }

  const handleSubmit = () => {
    if (frozen || !hasSelection) {
      return
    }

    setSubmitted(true)
    onSubmit({ answerKeys: [...selected].sort((a, b) => a - b) })
  }

  return (
    <>
      <AnswerReveal index={0} as="div">
        {/* 48 px lines: each passage, on its tint, is 44 px tall at least, a
        target for a thumb, and a line with one is as tall as a line without. */}
        <p className={clsx(card, "px-3 py-2 text-lg leading-9 font-medium")}>
          {parts.map((part, key) =>
            part.passage === undefined ? (
              <Fragment key={key}>{part.text}</Fragment>
            ) : (
              <PassageToggle
                key={key}
                index={part.passage}
                text={part.text}
                checked={selected.includes(part.passage)}
                disabled={frozen}
                onToggle={toggle(part.passage)}
              />
            ),
          )}
        </p>
      </AnswerReveal>

      <SubmitAnswer
        ref={submitBlock}
        index={1}
        disabled={frozen || !hasSelection}
        onClick={handleSubmit}
        count={selected.length}
        help={!locked && !hasSelection ? t("game:answer.highlightEmpty") : ""}
      />
    </>
  )
}

export default HighlightAnswers
