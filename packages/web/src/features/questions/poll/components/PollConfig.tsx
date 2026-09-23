import Switch from "@razzia/web/components/Switch"
import { withoutOption } from "@razzia/web/features/questions/options"
import BaseConfig from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/BaseConfig"
import ConfigField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigSection from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { ListChecks } from "lucide-react"
import { useTranslation } from "react-i18next"

// Unscored: no scoring section, how players answer comes first, as a word
// cloud's fields.
const PollConfig = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const multiple = currentQuestion.options?.multiple === true

  const handleToggle = (checked: boolean) => {
    updateQuestion(currentIndex, {
      options: checked
        ? { ...currentQuestion.options, multiple: true }
        : withoutOption(currentQuestion.options, "multiple"),
    })
  }

  return (
    <>
      <ConfigSection title={t("quizz:question.config.input")}>
        <ConfigField>
          <ConfigField.Label
            icon={<ListChecks className="size-4" />}
            label={t("quizz:question.config.pollMultiple")}
            action={
              <Switch
                aria-label={t("quizz:question.config.pollMultiple")}
                checked={multiple}
                onCheckedChange={handleToggle}
              />
            }
          />
          <ConfigField.Description>
            {t("quizz:question.config.pollMultipleHint")}
          </ConfigField.Description>
        </ConfigField>
      </ConfigSection>
      <BaseConfig />
    </>
  )
}

export default PollConfig
