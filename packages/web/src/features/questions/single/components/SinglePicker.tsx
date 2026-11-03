import { ANSWERS_LABELS } from "@razzia/web/features/game/utils/constants"
import { creditsForSolutions } from "@razzia/web/features/questions/single/utils/credits"
import type { SolutionPickerProps } from "@razzia/web/features/questions/types"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Check } from "lucide-react"
import type { KeyboardEvent } from "react"
import { useTranslation } from "react-i18next"

const NEXT_KEYS = new Set(["ArrowDown", "ArrowRight"])

const PREVIOUS_KEYS = new Set(["ArrowUp", "ArrowLeft"])

// A single choice has one right answer, as players tap one: picking an answer
// replaces the previous one. Several right answers make a multiple choice.
// With partial credit, the other answers earn the credit the author gives
// them. Radio pattern: only the selected radio is in the tab order, and the
// arrow keys select and focus the next or the previous answer.
const SingleSolutionPicker = ({ index, isSelected }: SolutionPickerProps) => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  // With no valid solution yet, the first radio stays reachable by Tab.
  const hasSelection = currentQuestion.solutions.some(
    (s) => s < currentQuestion.answers.length,
  )
  const isTabStop = isSelected || (!hasSelection && index === 0)

  const handleSelect = () => {
    // A stored question may still accept several answers: picking one of
    // them keeps that one only.
    if (isSelected && currentQuestion.solutions.length === 1) {
      return
    }

    const { options } = currentQuestion
    const solutions = [index]

    updateQuestion(currentIndex, {
      solutions,
      ...(options?.credits !== undefined && {
        options: {
          ...options,
          credits: creditsForSolutions(currentQuestion, solutions),
        },
      }),
    })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = NEXT_KEYS.has(event.key) ? 1 : -1

    if (
      (!NEXT_KEYS.has(event.key) && !PREVIOUS_KEYS.has(event.key)) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return
    }

    event.preventDefault()
    const radios = Array.from(
      event.currentTarget
        .closest("[role=radiogroup]")
        ?.querySelectorAll<HTMLButtonElement>("[role=radio]") ?? [],
    )
    const position = radios.indexOf(event.currentTarget)
    const target = radios.at((position + step) % radios.length)

    if (!target || target === event.currentTarget) {
      return
    }

    target.click()
    target.focus()
  }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-label={t("quizz:answers.correctToggle", {
        letter: ANSWERS_LABELS[index],
      })}
      tabIndex={isTabStop ? 0 : -1}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className={clsx(
        "ease-out-quart focus-visible:ring-primary relative flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300 before:absolute before:-inset-2 before:content-[''] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none",
        isSelected
          ? "border-primary bg-primary text-white"
          : "border-muted-foreground hover:border-primary bg-white",
      )}
    >
      {isSelected && <Check className="size-4 stroke-3" aria-hidden />}
    </button>
  )
}

export default SingleSolutionPicker
