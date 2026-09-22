import { QUESTION_TYPE_META } from "@razzia/common/constants"
import type { QuestionType } from "@razzia/common/types/game"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@razzia/web/components/Select"
import {
  defaultTimeOf,
  QUESTION_REGISTRY,
  QUESTION_TYPE_LIST,
} from "@razzia/web/features/questions"
import ConfigField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { LayoutList } from "lucide-react"
import { useTranslation } from "react-i18next"

const QuestionEditorConfig = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const questionType = currentQuestion.type

  const handleTypeChange = (nextType: QuestionType) => {
    const meta = QUESTION_TYPE_META[nextType]
    const next = QUESTION_REGISTRY[nextType]
    const { defaultOptions, defaultAnswerKeys, initialAnswers } = next
    // A type with its own answers editor (ordering, shortanswer) shares
    // nothing with the others: moving to or from one starts from a blank
    // question of the new type.
    const isReset = Boolean(
      next.AnswersEditor ?? QUESTION_REGISTRY[questionType].AnswersEditor,
    )
    const answers = isReset ? [] : currentQuestion.answers
    const solutions = isReset ? [] : currentQuestion.solutions
    const updates: Parameters<typeof updateQuestion>[1] = {
      type: nextType,
      options: defaultOptions,
    }

    if (isReset) {
      updates.accepted = next.initialAccepted && [...next.initialAccepted]
      updates.speedBonus = undefined
    }

    // An answer time left at the old type's default follows the new one.
    if (currentQuestion.time === defaultTimeOf(questionType)) {
      updates.time = defaultTimeOf(nextType)
    }

    if (!meta.acceptsAnswers) {
      updates.answers = []
      updates.solutions = []
    } else if (initialAnswers) {
      updates.answers = [...initialAnswers]
      updates.solutions = []
    } else if (defaultAnswerKeys) {
      // Fixed answers (true/false): impose the wording and a single solution.
      updates.answers = defaultAnswerKeys.map((key) => t(key))
      updates.solutions = [0]
    } else {
      if (answers.length < 2) {
        updates.answers = ["", ""]
      }

      if (!meta.scored) {
        updates.solutions = []
      } else if (solutions.length === 0) {
        updates.solutions = [0]
      }
    }

    updateQuestion(currentIndex, updates)
  }

  const { ConfigComponent } = QUESTION_REGISTRY[questionType]

  const typeOptions = QUESTION_TYPE_LIST.map((type) => ({
    value: type,
    label: t(QUESTION_REGISTRY[type].labelKey),
  }))

  return (
    <aside className="bg-background z-10 m-3 flex max-h-[calc(100%-1.5rem)] w-68 shrink-0 flex-col gap-3 self-start overflow-y-auto rounded-xl p-4 shadow-sm">
      <ConfigField>
        <ConfigField.Label
          icon={<LayoutList className="size-4" />}
          label={t("quizz:question.config.answerMode")}
        />
        <Select value={questionType} onValueChange={handleTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ConfigField>

      <ConfigComponent />
    </aside>
  )
}

export default QuestionEditorConfig
