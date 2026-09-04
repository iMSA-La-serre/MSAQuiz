import type { SolutionPickerProps } from "@razzia/web/features/questions/types"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Check } from "lucide-react"

// Exactly one of the two answers is correct: picking one replaces the other,
// so the author can never leave a true/false question without a solution.
const TrueFalsePicker = ({ index, isSelected }: SolutionPickerProps) => {
  const { currentIndex, updateQuestion } = useQuizzEditor()

  const handleSelect = () => {
    updateQuestion(currentIndex, { solutions: [index] })
  }

  return (
    <button
      type="button"
      onClick={handleSelect}
      className={clsx(
        "flex size-6 shrink-0 items-center justify-center rounded-full transition-colors",
        isSelected ? "bg-white text-green-600" : "bg-white/20",
      )}
    >
      {isSelected && <Check className="size-4 stroke-5" />}
    </button>
  )
}

export default TrueFalsePicker
