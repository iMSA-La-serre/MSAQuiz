import { ANSWERS_LABELS } from "@razzia/web/features/game/utils/constants"
import { creditsForSolutions } from "@razzia/web/features/questions/single/utils/credits"
import type { SolutionPickerProps } from "@razzia/web/features/questions/types"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"

// A single-choice question may accept several answers, so each answer gets a
// checkbox; the last ticked box cannot be unticked. With partial credit, a
// right answer earns all the points and an answer unticked none, until the
// author gives it a credit.
const SingleSolutionPicker = ({ index, isSelected }: SolutionPickerProps) => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()

  const setSolutions = (solutions: number[]) => {
    const { options } = currentQuestion

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

  const handleToggle = () => {
    const current = currentQuestion.solutions

    if (current.includes(index)) {
      const next = current.filter((s) => s !== index)

      setSolutions(next.length > 0 ? next : [index])

      return
    }

    setSolutions([...current, index])
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

export default SingleSolutionPicker
