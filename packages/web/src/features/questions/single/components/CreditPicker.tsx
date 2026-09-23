import { CREDIT_STEPS, FULL_CREDIT } from "@razzia/common/constants"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@razzia/web/components/Select"
import { ANSWERS_LABELS } from "@razzia/web/features/game/utils/constants"
import {
  creditOf,
  formatCredit,
  withCredit,
} from "@razzia/web/features/questions/single/utils/credits"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { useTranslation } from "react-i18next"

interface Props {
  index: number
}

// Partial credit, next to the « Bonne réponse » box of an answer: the share
// of the points a wrong answer earns, from a menu, as a categorize item's
// category. A right answer earns them all, written in the menu's place.
const CreditPicker = ({ index }: Props) => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t, i18n } = useTranslation()
  const letter = ANSWERS_LABELS[index]

  if (currentQuestion.solutions.includes(index)) {
    return (
      <span
        aria-hidden
        className="text-muted-foreground px-3.5 text-sm font-semibold tabular-nums"
      >
        {formatCredit(i18n.language, FULL_CREDIT)}
      </span>
    )
  }

  return (
    <Select
      value={String(creditOf(currentQuestion, index))}
      onValueChange={(value) => {
        updateQuestion(currentIndex, {
          options: {
            ...currentQuestion.options,
            credits: withCredit(currentQuestion, index, Number(value)),
          },
        })
      }}
    >
      <SelectTrigger
        className="min-h-11 tabular-nums sm:min-h-0"
        aria-label={t("quizz:answers.creditLabel", { letter })}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CREDIT_STEPS.map((step) => (
          <SelectItem key={step} value={String(step)}>
            {formatCredit(i18n.language, step)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default CreditPicker
