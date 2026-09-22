import { MATCH_SCORING } from "@razzia/common/constants"
import type { MatchScoring } from "@razzia/common/types/game"
import { matchScoringOf } from "@razzia/common/utils/association"
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
import { Scale } from "lucide-react"
import { useTranslation } from "react-i18next"

const MODES: MatchScoring[] = [MATCH_SCORING.SHARE, MATCH_SCORING.EXACT]

// The settings of an ordering: points, speed bonus, penalty, then the scoring,
// the share of right answers or all or nothing.
const AssociationConfig = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const mode = matchScoringOf(currentQuestion.options?.matchScoring)

  const handleChange = (next: MatchScoring) => {
    updateQuestion(currentIndex, {
      options: { ...currentQuestion.options, matchScoring: next },
    })
  }

  return (
    <BaseConfig>
      <ConfigField>
        <ConfigField.Label
          icon={<Scale className="size-4" />}
          label={t("quizz:question.config.matchScoring")}
        />
        <Select value={mode} onValueChange={handleChange}>
          <SelectTrigger aria-label={t("quizz:question.config.matchScoring")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`quizz:question.config.matchScoring.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ConfigField.Description>
          {t(`quizz:question.config.matchScoringHint.${mode}`)}
        </ConfigField.Description>
      </ConfigField>
    </BaseConfig>
  )
}

export default AssociationConfig
