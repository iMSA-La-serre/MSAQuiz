import { WORDCLOUD_LIMITS } from "@razzia/common/constants"
import { wordCountOf } from "@razzia/common/utils/wordcloud"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@razzia/web/components/Select"
import BaseConfig from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/BaseConfig"
import ConfigField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigSection from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { TextCursorInput } from "lucide-react"
import { useTranslation } from "react-i18next"

const COUNTS = Array.from(
  { length: WORDCLOUD_LIMITS.MAX_WORDS - WORDCLOUD_LIMITS.MIN_WORDS + 1 },
  (_, index) => WORDCLOUD_LIMITS.MIN_WORDS + index,
)

// Unscored: no scoring section, the fields per player come first.
const WordCloudConfig = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const wordCount = wordCountOf(currentQuestion.options)

  const handleChange = (next: string) => {
    updateQuestion(currentIndex, {
      options: { ...currentQuestion.options, wordCount: Number(next) },
    })
  }

  return (
    <>
      <ConfigSection title={t("quizz:question.config.input")}>
        <ConfigField>
          <ConfigField.Label
            icon={<TextCursorInput className="size-4" />}
            label={t("quizz:question.config.wordCount")}
          />
          <Select value={String(wordCount)} onValueChange={handleChange}>
            <SelectTrigger aria-label={t("quizz:question.config.wordCount")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTS.map((count) => (
                <SelectItem key={count} value={String(count)}>
                  {t("quizz:question.config.wordCountValue", { count })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ConfigField.Description>
            {t("quizz:question.config.wordCountHint", {
              max: WORDCLOUD_LIMITS.WORD_LENGTH,
            })}
          </ConfigField.Description>
        </ConfigField>
      </ConfigSection>
      <BaseConfig />
    </>
  )
}

export default WordCloudConfig
