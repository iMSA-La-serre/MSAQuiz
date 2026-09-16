import { ANSWERS_LABELS } from "@razzia/web/features/game/utils/constants"
import type { SolutionPickerProps } from "@razzia/web/features/questions/types"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Check } from "lucide-react"
import type { KeyboardEvent } from "react"
import { useTranslation } from "react-i18next"

const ARROW_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]

// Exactly one of the two answers is correct: picking one replaces the other,
// so the author can never leave a true/false question without a solution.
// Radio pattern: only the selected radio is in the tab order, and the arrow
// keys select and focus the other answer.
const TrueFalsePicker = ({ index, isSelected }: SolutionPickerProps) => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  // With no valid solution yet, the first radio stays reachable by Tab.
  const hasSelection = currentQuestion.solutions.some(
    (s) => s < currentQuestion.answers.length,
  )
  const isTabStop = isSelected || (!hasSelection && index === 0)

  const handleSelect = () => {
    updateQuestion(currentIndex, { solutions: [index] })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      !ARROW_KEYS.includes(event.key) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return
    }

    event.preventDefault()
    const current = event.currentTarget
    const radios = current
      .closest("[role=radiogroup]")
      ?.querySelectorAll<HTMLButtonElement>("[role=radio]")
    const other = Array.from(radios ?? []).find((radio) => radio !== current)

    if (!other) {
      return
    }

    other.click()
    other.focus()
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

export default TrueFalsePicker
