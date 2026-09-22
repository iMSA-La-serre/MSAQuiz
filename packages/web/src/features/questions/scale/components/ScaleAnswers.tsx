import {
  scaleRangeOf,
  scaleSkipAllowed,
  scaleSkipIndex,
  scaleValues,
} from "@razzia/common/utils/scale"
import { AnswerReveal } from "@razzia/web/features/game/components/question/AnswerRow"
import SubmitAnswer from "@razzia/web/features/game/components/question/SubmitAnswer"
import { endLabelOf } from "@razzia/web/features/questions/scale/utils/format"
import type { AnswerComponentProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

// Levels that still share one line of the card: five of them take 5 × 44 px
// (the smallest tap target) and their gaps, which is exactly the 256 px a
// 320 px phone leaves inside the card. Past five they take two lines.
const ONE_LINE_LEVELS = 5

// Fixed columns, as the targets of a statement: every level is as wide as the
// others, on the second line too, where a wrapping row would stretch the last
// one across the card and make it read as another « Je préfère ne pas
// répondre ». Written out, Tailwind reading the class names as they are.
const GRID_COLUMNS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
}

// Three to eight levels: 3, 4 and 5 on one line, then 6 as 3 + 3, 7 as 4 + 3
// and 8 as 4 + 4.
const columnsClass = (count: number): string =>
  GRID_COLUMNS[count <= ONE_LINE_LEVELS ? count : Math.ceil(count / 2)] ??
  "grid-cols-4"

// A level, as the targets of a statement: tinted, outlined once picked,
// 44 px tall at least.
const LEVEL =
  "ease-out-quart has-focus-visible:outline-serre-yellow relative flex items-center justify-center rounded-xl text-center font-bold transition-[background-color,box-shadow] duration-300 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-disabled:cursor-default motion-reduce:transition-none"

const PICKED = "bg-primary/15 ring-primary ring-2 ring-inset"

const IDLE = "bg-secondary/10"

// Scale: the levels in a white card, as a row of buttons under the question,
// with what each end stands for below them and, when the author offers it,
// « Je préfère ne pas répondre ». Native radio buttons, hidden, whose labels
// are the buttons; « Valider » sends the one picked, as a series of
// statements does. The projector shows the same card, never answered.
const ScaleAnswers = ({
  options,
  onSubmit,
  readOnly,
  locked = false,
  size,
}: AnswerComponentProps) => {
  const { t } = useTranslation()
  const groupId = useId()
  const [picked, setPicked] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const range = scaleRangeOf(options)
  const values = scaleValues(range)
  const skipIndex = scaleSkipIndex(range)
  const hasSkip = scaleSkipAllowed(options)
  const frozen = locked || submitted
  const isHost = size === "host"
  const low = endLabelOf(options, range, range.min)
  const high = endLabelOf(options, range, range.max)

  const submit = () => {
    if (frozen || picked === null) {
      return
    }

    setSubmitted(true)
    onSubmit({ answerKeys: [picked] })
  }

  const levelClassName = clsx(
    LEVEL,
    isHost
      ? "short:min-h-12 min-h-14 px-2 py-1 text-2xl xl:min-h-16 xl:text-3xl"
      : "min-h-11 px-2 py-1 text-lg",
  )

  // The way out of the scale, across the card. Its label is centred as every
  // other full-width button's is: the gap above already sets it apart.
  const skipClassName = clsx(
    LEVEL,
    "w-full",
    isHost ? "min-h-12 text-xl" : "min-h-11 text-base",
  )

  const renderLevel = (value: number, index: number) => {
    const end = endLabelOf(options, range, value)
    const label =
      end === ""
        ? t("game:scale.levelLabel", { value, max: range.max })
        : t("game:scale.levelLabelEnd", { value, max: range.max, label: end })

    if (readOnly) {
      return (
        <span
          key={value}
          className={clsx(levelClassName, "text-secondary min-w-11", IDLE)}
        >
          {value}
        </span>
      )
    }

    return (
      <label
        key={value}
        className={clsx(
          levelClassName,
          "text-secondary min-w-11 cursor-pointer",
          picked === index ? PICKED : clsx(IDLE, "active:bg-secondary/20"),
        )}
      >
        <input
          type="radio"
          className="sr-only"
          name={groupId}
          value={index}
          checked={picked === index}
          disabled={frozen}
          aria-label={label}
          onChange={() => {
            setPicked(index)
          }}
        />
        {value}
      </label>
    )
  }

  const renderSkip = () => {
    if (!hasSkip) {
      return null
    }

    if (readOnly) {
      return (
        <span className={clsx(skipClassName, "text-secondary/75", IDLE)}>
          {t("game:scale.skip")}
        </span>
      )
    }

    return (
      <label
        className={clsx(
          skipClassName,
          "text-secondary/75 cursor-pointer",
          picked === skipIndex ? PICKED : clsx(IDLE, "active:bg-secondary/20"),
        )}
      >
        <input
          type="radio"
          className="sr-only"
          name={groupId}
          value={skipIndex}
          checked={picked === skipIndex}
          disabled={frozen}
          onChange={() => {
            setPicked(skipIndex)
          }}
        />
        {t("game:scale.skip")}
      </label>
    )
  }

  return (
    <>
      <AnswerReveal index={0} as="div">
        <div
          className={clsx(
            "rounded-2xl",
            isHost ? "short:px-5 short:py-3 px-6 py-5" : "px-4 py-3",
            locked
              ? "bg-white/70 shadow-none"
              : "bg-white shadow-lg shadow-black/15",
          )}
        >
          {/* The levels, then what each end stands for, then the way out of
          the scale: the reading order of the question. The projector holds no
          radio button, so its card is a plain container, as an association's
          read-only rows are. */}
          <div
            role={readOnly ? undefined : "radiogroup"}
            aria-label={
              readOnly
                ? undefined
                : t("game:scale.groupLabel", {
                    min: range.min,
                    max: range.max,
                  })
            }
            className="flex flex-col gap-2"
          >
            <div className={clsx("grid gap-2", columnsClass(values.length))}>
              {values.map(renderLevel)}
            </div>

            {(low !== "" || high !== "") && (
              <p
                className={clsx(
                  "text-secondary/75 flex items-start justify-between gap-4 font-semibold",
                  isHost ? "text-lg xl:text-xl" : "text-sm",
                )}
              >
                <span className="min-w-0 flex-1">{low}</span>
                <span className="min-w-0 flex-1 text-right">{high}</span>
              </p>
            )}

            {renderSkip()}
          </div>
        </div>
      </AnswerReveal>

      {!readOnly && (
        <SubmitAnswer
          index={1}
          disabled={frozen || picked === null}
          onClick={submit}
          help={!locked && picked === null ? t("game:answer.scaleEmpty") : ""}
        />
      )}
    </>
  )
}

export default ScaleAnswers
