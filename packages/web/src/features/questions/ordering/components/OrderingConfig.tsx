import { ORDER_SCORING } from "@razzia/common/constants"
import type { OrderScoring } from "@razzia/common/types/game"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@razzia/web/components/Select"
import BaseConfig from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/BaseConfig"
import ConfigField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { ListOrdered } from "lucide-react"
import { useTranslation } from "react-i18next"

const MODES: OrderScoring[] = [ORDER_SCORING.POSITION, ORDER_SCORING.EXACT]

const OrderingConfig = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const mode = currentQuestion.options?.orderScoring ?? ORDER_SCORING.POSITION

  const handleChange = (next: OrderScoring) => {
    updateQuestion(currentIndex, {
      options: { ...currentQuestion.options, orderScoring: next },
    })
  }

  return (
    <BaseConfig>
      <ConfigField>
        <ConfigField.Label
          icon={<ListOrdered className="size-4" />}
          label={t("quizz:question.config.orderScoring")}
        />
        <Select value={mode} onValueChange={handleChange}>
          <SelectTrigger aria-label={t("quizz:question.config.orderScoring")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`quizz:question.config.orderScoring.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ConfigField.Description>
          {t(`quizz:question.config.orderScoringHint.${mode}`)}
        </ConfigField.Description>
      </ConfigField>
    </BaseConfig>
  )
}

export default OrderingConfig
