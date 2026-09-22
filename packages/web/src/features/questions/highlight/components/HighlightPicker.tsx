import { answerLetter } from "@razzia/web/features/game/utils/constants"
import type { SolutionPickerProps } from "@razzia/web/features/questions/types"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"

// The box of a multiple choice's correct answers, for a passage to spot. Up
// to five passages: lettered past D. The last ticked box cannot be unticked.
// Named with the passage's words, which a keyboard does not reach.
const HighlightPicker = ({ index, isSelected }: SolutionPickerProps) => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()

  const handleToggle = () => {
    const current = currentQuestion.solutions

    if (current.includes(index)) {
      const next = current.filter((s) => s !== index)

      updateQuestion(currentIndex, {
        solutions: next.length > 0 ? next : [index],
      })

      return
    }

    updateQuestion(currentIndex, {
      solutions: [...current, index].sort((a, b) => a - b),
    })
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isSelected}
      aria-label={t("quizz:highlight.correctToggle", {
        letter: answerLetter(index),
        passage: currentQuestion.answers.at(index) ?? "",
      })}
      onClick={handleToggle}
      className={clsx(
        "ease-out-quart focus-visible:ring-primary relative flex size-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-300 before:absolute before:-inset-2 before:content-[''] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none",
        isSelected
          ? "border-primary bg-primary text-white"
          : "border-muted-foreground hover:border-primary bg-white",
      )}
    >
      {isSelected && <Check className="size-4 stroke-3" aria-hidden />}
    </button>
  )
}

export default HighlightPicker
