import { SCORING_MODES } from "@razzia/common/constants"
import type { ScoringMode } from "@razzia/common/types/game"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@razzia/web/components/Select"
import ConfigField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { ListChecks } from "lucide-react"
import { useTranslation } from "react-i18next"

interface Props {
  // The modes this type offers, in the order they are shown.
  modes: ScoringMode[]
}

// How a question with several right answers shares its points, from the
// multiple choice's modes. Shown by the types whose registry entry lists
// them, and by the markers questions with several right markers.
const ScoringModeField = ({ modes }: Props) => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const scoringMode =
    currentQuestion.options?.scoringMode ?? SCORING_MODES.BALANCED

  return (
    <ConfigField>
      <ConfigField.Label
        icon={<ListChecks className="size-4" />}
        label={t("quizz:question.config.scoringMode")}
      />
      <Select
        value={scoringMode}
        onValueChange={(mode: ScoringMode) => {
          updateQuestion(currentIndex, { options: { scoringMode: mode } })
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {modes.map((mode) => (
            <SelectItem key={mode} value={mode}>
              {t(`quizz:question.config.scoringMode.${mode}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ConfigField.Description>
        {t(`quizz:question.config.scoringModeHint.${scoringMode}`)}
      </ConfigField.Description>
    </ConfigField>
  )
}

export default ScoringModeField
