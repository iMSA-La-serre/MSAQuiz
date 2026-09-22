import { scaleRangeOf, scaleSkipAllowed } from "@razzia/common/utils/scale"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@razzia/web/components/Select"
import Switch from "@razzia/web/components/Switch"
import BaseConfig from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/BaseConfig"
import ConfigField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigSection from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { CircleSlash, Gauge } from "lucide-react"
import { useTranslation } from "react-i18next"

// The scales an author picks from: the usual appreciation scales, from 1 or
// from 0. Another scale, imported as JSON, joins the list.
const PRESETS: Array<{ min: number; max: number }> = [
  { min: 1, max: 3 },
  { min: 1, max: 4 },
  { min: 1, max: 5 },
  { min: 1, max: 6 },
  { min: 1, max: 7 },
  { min: 1, max: 8 },
  { min: 0, max: 5 },
  { min: 0, max: 7 },
]

const keyOf = ({ min, max }: { min: number; max: number }) => `${min}-${max}`

// Unscored: no scoring section. The levels come first, then the option that
// lets a player answer without picking one.
const ScaleConfig = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const { options } = currentQuestion
  const range = scaleRangeOf(options)
  const current = keyOf(range)
  const scales = PRESETS.some((preset) => keyOf(preset) === current)
    ? PRESETS
    : [...PRESETS, { min: range.min, max: range.max }]

  const handleRange = (next: string) => {
    const [min, max] = next.split("-").map(Number)

    updateQuestion(currentIndex, {
      options: { ...options, scaleMin: min, scaleMax: max },
    })
  }

  const handleSkip = (checked: boolean) => {
    updateQuestion(currentIndex, {
      options: { ...options, scaleSkip: checked },
    })
  }

  return (
    <>
      <ConfigSection title={t("quizz:scale.title")}>
        <ConfigField>
          <ConfigField.Label
            icon={<Gauge className="size-4" />}
            label={t("quizz:question.config.scaleRange")}
          />
          <Select value={current} onValueChange={handleRange}>
            <SelectTrigger aria-label={t("quizz:question.config.scaleRange")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scales.map((preset) => (
                <SelectItem key={keyOf(preset)} value={keyOf(preset)}>
                  {t("quizz:scale.range", { ...preset })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ConfigField.Description>
            {t("quizz:question.config.scaleRangeHint")}
          </ConfigField.Description>
        </ConfigField>

        <ConfigField>
          <ConfigField.Label
            icon={<CircleSlash className="size-4" />}
            label={t("quizz:question.config.scaleSkip")}
            action={
              <Switch
                aria-label={t("quizz:question.config.scaleSkip")}
                checked={scaleSkipAllowed(options)}
                onCheckedChange={handleSkip}
              />
            }
          />
          <ConfigField.Description>
            {t("quizz:question.config.scaleSkipHint")}
          </ConfigField.Description>
        </ConfigField>
      </ConfigSection>
      <BaseConfig />
    </>
  )
}

export default ScaleConfig
