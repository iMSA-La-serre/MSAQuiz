import Switch from "@razzia/web/components/Switch"
import { withoutOption } from "@razzia/web/features/questions/options"
import { initialCredits } from "@razzia/web/features/questions/single/utils/credits"
import BaseConfig from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/BaseConfig"
import ConfigField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { Percent } from "lucide-react"
import { useTranslation } from "react-i18next"

// The settings of a choice, and partial credit at the end of the scoring
// section: once on, the answers that are not right get a credit each, in the
// « Bonne réponse » column of the answers.
const SingleConfig = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const enabled = currentQuestion.options?.credits !== undefined

  const handleToggle = (checked: boolean) => {
    updateQuestion(currentIndex, {
      options: checked
        ? {
            ...currentQuestion.options,
            credits: initialCredits(currentQuestion),
          }
        : withoutOption(currentQuestion.options, "credits"),
    })
  }

  return (
    <BaseConfig>
      <ConfigField>
        <ConfigField.Label
          icon={<Percent className="size-4" />}
          label={t("quizz:question.config.credits")}
          action={
            <Switch
              aria-label={t("quizz:question.config.credits")}
              checked={enabled}
              onCheckedChange={handleToggle}
            />
          }
        />
        <ConfigField.Description>
          {t("quizz:question.config.creditsHint")}
        </ConfigField.Description>
      </ConfigField>
    </BaseConfig>
  )
}

export default SingleConfig
