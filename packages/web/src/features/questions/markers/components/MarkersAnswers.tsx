import AnswerRow, {
  AnswerReveal,
  isCompactList,
  rowChipSize,
} from "@razzia/web/features/game/components/question/AnswerRow"
import SubmitAnswer from "@razzia/web/features/game/components/question/SubmitAnswer"
import TickBox from "@razzia/web/features/game/components/question/TickBox"
import MarkerChip from "@razzia/web/features/questions/markers/components/MarkerChip"
import { useMarkersPicking } from "@razzia/web/features/questions/markers/context"
import type { AnswerComponentProps } from "@razzia/web/features/questions/types"
import clsx from "clsx"
import { Check } from "lucide-react"
import { useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

// Markers: the numbered list of the markers placed on the image, in the rows
// of a choice. It is the answer for the keyboard and the screen reader; the
// markers on the image answer under the thumb, and both fill the same
// selection. One tap sends the answer, as on a single choice, unless several
// markers are right: the rows are then toggles, and « Valider » sends them
// all, as on a multiple choice.
const MarkersAnswers = ({
  answers,
  readOnly,
  locked = false,
  size,
}: AnswerComponentProps) => {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const { selected, submitted, multiple, pick, submit } = useMarkersPicking()
  const submitBlock = useRef<HTMLDivElement>(null)
  // A marker ticked in the list, not on the image: see below.
  const tickedInList = useRef(false)
  // Five or six markers on the projector: compact rows, as the distribution
  // and an ordering's.
  const compact = size === "host" && isCompactList(answers.length)

  // Six rows under an image can push « Valider » below a phone's fold: once
  // a marker is ticked in the list, the button scrolls into view, as a
  // highlight's does, and not at all when it is already in view. Not from
  // the image: the player is still looking at it, and scrolling would slide
  // the markers out of view.
  useEffect(() => {
    if (!tickedInList.current) {
      return
    }

    tickedInList.current = false
    submitBlock.current?.scrollIntoView({
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    })
  }, [selected, reduceMotion])

  return (
    <>
      <ol
        className={clsx("flex flex-col", {
          "gap-2": size === "phone" || compact,
          "short:gap-2 gap-3 xl:gap-4": size === "host" && !compact,
        })}
      >
        {answers.map((label, index) => {
          const isSelected = selected.includes(index)

          return (
            <AnswerReveal key={index} index={index}>
              <AnswerRow
                index={index}
                text={label}
                size={size}
                locked={locked}
                compact={compact}
                marker={
                  <MarkerChip index={index} size={rowChipSize(size, compact)} />
                }
                outlined={isSelected}
                {...(!readOnly && {
                  interactive: true,
                  disabled: submitted,
                  onClick: () => {
                    tickedInList.current = multiple && !isSelected
                    pick(index)
                  },
                  // A single right marker: the tapped row is outlined at once
                  // and every row is disabled, as on a single choice.
                  className: clsx(
                    !multiple && submitted && !isSelected && "opacity-60",
                  ),
                  ...(multiple && {
                    role: "checkbox",
                    "aria-checked": isSelected,
                    trailing: (
                      <TickBox checked={isSelected}>
                        <Check className="size-5 stroke-3" />
                      </TickBox>
                    ),
                  }),
                })}
              />
            </AnswerReveal>
          )
        })}
      </ol>

      {!readOnly && multiple && (
        <SubmitAnswer
          ref={submitBlock}
          index={answers.length}
          disabled={locked || submitted || selected.length === 0}
          onClick={submit}
          count={selected.length}
          help={
            !locked && selected.length === 0
              ? t("game:answer.markersEmpty")
              : ""
          }
        />
      )}
    </>
  )
}

export default MarkersAnswers
