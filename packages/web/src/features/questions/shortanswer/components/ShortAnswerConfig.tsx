import Switch from "@razzia/web/components/Switch"
import BaseConfig from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/BaseConfig"
import ConfigField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { SpellCheck } from "lucide-react"
import { useTranslation } from "react-i18next"

const ShortAnswerConfig = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const typoTolerance = currentQuestion.options?.typoTolerance ?? false

  const handleToggle = (checked: boolean) => {
    updateQuestion(currentIndex, {
      options: { ...currentQuestion.options, typoTolerance: checked },
    })
  }

  return (
    <BaseConfig>
      <ConfigField>
        <ConfigField.Label
          icon={<SpellCheck className="size-4" />}
          label={t("quizz:question.config.typoTolerance")}
          action={
            <Switch
              aria-label={t("quizz:question.config.typoTolerance")}
              checked={typoTolerance}
              onCheckedChange={handleToggle}
            />
          }
        />
        <ConfigField.Description>
          {t("quizz:question.config.typoToleranceHint")}
        </ConfigField.Description>
      </ConfigField>
    </BaseConfig>
  )
}

export default ShortAnswerConfig
