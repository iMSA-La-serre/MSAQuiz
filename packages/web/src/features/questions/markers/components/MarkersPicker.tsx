import { markerName } from "@razzia/web/features/questions/markers/utils/names"
import type { SolutionPickerProps } from "@razzia/web/features/questions/types"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"

// The box of a choice's correct answers, for a marker. Ticking a second one
// turns the question into a multiple choice, on the mode set next to it; the
// last ticked box cannot be unticked. Named with the marker's number and
// label, as the rows are.
const MarkersPicker = ({ index, isSelected }: SolutionPickerProps) => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()

  const handleToggle = () => {
    const current = currentQuestion.solutions

    if (current.includes(index)) {
      const next = current.filter((solution) => solution !== index)

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
      aria-label={t("quizz:markers.correctToggle", {
        marker: markerName(t, index, currentQuestion.answers.at(index)),
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

export default MarkersPicker
