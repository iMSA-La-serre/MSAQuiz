import { ANSWERS_LABELS } from "@razzia/web/features/game/utils/constants"
import type { SolutionPickerProps } from "@razzia/web/features/questions/types"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Check } from "lucide-react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

// A multiple choice has two right answers at least: with one, it would be a
// single choice. A box is not unticked below two; to change one of them, the
// author ticks the new one first.
const MultiSolutionPicker = ({ index, isSelected }: SolutionPickerProps) => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()

  const handleToggle = () => {
    const current = currentQuestion.solutions

    if (!current.includes(index)) {
      updateQuestion(currentIndex, { solutions: [...current, index] })

      return
    }

    if (current.length <= 2) {
      toast.error(t("errors:quizz.multiTwoSolutions"))

      return
    }

    updateQuestion(currentIndex, {
      solutions: current.filter((s) => s !== index),
    })
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isSelected}
      aria-label={t("quizz:answers.correctToggle", {
        letter: ANSWERS_LABELS[index],
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

export default MultiSolutionPicker
