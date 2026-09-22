import {
  MAX_POINTS,
  NO_TIME_LIMIT,
  QUESTION_TYPE_META,
} from "@razzia/common/constants"
import type { ScoringMode } from "@razzia/common/types/game"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@razzia/web/components/Select"
import Switch from "@razzia/web/components/Switch"
import {
  defaultTimeOf,
  QUESTION_REGISTRY,
} from "@razzia/web/features/questions"
import ConfigField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigNumberInput from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigNumberInput"
import ConfigSection from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import {
  ArrowBigDownDash,
  Clock,
  ListChecks,
  Star,
  Timer,
  Zap,
} from "lucide-react"
import type { PropsWithChildren } from "react"
import { useTranslation } from "react-i18next"

const DEFAULT_PENALTY = 100

// Children: the type's own scoring fields, at the end of the scoring section.
const BaseConfig = ({ children }: PropsWithChildren) => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const isTimeLimitEnabled = currentQuestion.time !== NO_TIME_LIMIT
  const isPenaltyEnabled = (currentQuestion.penalty ?? 0) > 0
  const meta = QUESTION_TYPE_META[currentQuestion.type]
  const isScored = meta.scored
  const isSpeedBonusEnabled = currentQuestion.speedBonus ?? meta.speedBonus
  const { scoringModes } = QUESTION_REGISTRY[currentQuestion.type]
  const scoringMode = currentQuestion.options?.scoringMode

  const handleScoringModeChange = (mode: ScoringMode) => {
    updateQuestion(currentIndex, { options: { scoringMode: mode } })
  }

  const handleUpdateQuestion = (key: string) => (value: string | number) => {
    updateQuestion(currentIndex, { [key]: value })
  }

  const handleToggleTimeLimit = (checked: boolean) => {
    updateQuestion(currentIndex, {
      time: checked ? defaultTimeOf(currentQuestion.type) : NO_TIME_LIMIT,
    })
  }

  const handleToggleSpeedBonus = (checked: boolean) => {
    updateQuestion(currentIndex, { speedBonus: checked })
  }

  // Without a time limit, the speed bonus follows the order of the answers.
  const noTimeLimitHint = isSpeedBonusEnabled
    ? t("quizz:question.config.noTimeLimitHint")
    : t("quizz:question.config.noTimeLimitNoBonusHint")

  const handleTogglePenalty = (checked: boolean) => {
    updateQuestion(currentIndex, {
      penalty: checked ? DEFAULT_PENALTY : undefined,
    })
  }

  const scoringOptions = scoringModes?.map((mode) => ({
    value: mode,
    label: t(`quizz:question.config.scoringMode.${mode}`),
  }))

  return (
    <>
      {isScored && (
        <ConfigSection title={t("quizz:question.config.scoring")}>
          <ConfigField>
            <ConfigField.Label
              icon={<Star className="size-4" />}
              label={t("quizz:question.config.maxPoints")}
              unit="pts"
            />
            <ConfigNumberInput
              value={currentQuestion.maxPoints ?? MAX_POINTS}
              min={0}
              onChange={handleUpdateQuestion("maxPoints")}
            />
            <ConfigField.Description>
              {t("quizz:question.config.maxPointsHint")}
            </ConfigField.Description>
          </ConfigField>

          <ConfigField>
            <ConfigField.Label
              icon={<Zap className="size-4" />}
              label={t("quizz:question.config.speedBonus")}
              action={
                <Switch
                  aria-label={t("quizz:question.config.speedBonus")}
                  checked={isSpeedBonusEnabled}
                  onCheckedChange={handleToggleSpeedBonus}
                />
              }
            />
            <ConfigField.Description>
              {isSpeedBonusEnabled
                ? t("quizz:question.config.speedBonusHint")
                : t("quizz:question.config.noSpeedBonusHint")}
            </ConfigField.Description>
          </ConfigField>

          <ConfigField>
            <ConfigField.Label
              icon={<ArrowBigDownDash className="size-4" />}
              label={t("quizz:question.config.penalty")}
              unit={isPenaltyEnabled ? "pts" : undefined}
              action={
                <Switch
                  checked={isPenaltyEnabled}
                  onCheckedChange={handleTogglePenalty}
                />
              }
            />
            {isPenaltyEnabled && (
              <ConfigNumberInput
                value={currentQuestion.penalty ?? DEFAULT_PENALTY}
                min={1}
                onChange={handleUpdateQuestion("penalty")}
              />
            )}
            <ConfigField.Description>
              {t("quizz:question.config.penaltyHint")}
            </ConfigField.Description>
          </ConfigField>

          {scoringModes && scoringMode && (
            <ConfigField>
              <ConfigField.Label
                icon={<ListChecks className="size-4" />}
                label={t("quizz:question.config.scoringMode")}
              />
              <Select
                value={scoringMode}
                onValueChange={handleScoringModeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scoringOptions?.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ConfigField.Description>
                {t(`quizz:question.config.scoringModeHint.${scoringMode}`)}
              </ConfigField.Description>
            </ConfigField>
          )}

          {children}
        </ConfigSection>
      )}

      <ConfigSection title={t("quizz:question.config.timings")}>
        <ConfigField>
          <ConfigField.Label
            icon={<Clock className="size-4" />}
            label={t("quizz:question.config.questionDisplay")}
            unit="sec"
          />
          <ConfigNumberInput
            value={currentQuestion.cooldown}
            min={3}
            max={15}
            onChange={handleUpdateQuestion("cooldown")}
          />
          <ConfigField.Description>
            {t("quizz:question.config.questionDisplayHint")}
          </ConfigField.Description>
        </ConfigField>

        <ConfigField>
          <ConfigField.Label
            icon={<Timer className="size-4" />}
            label={t("quizz:question.config.answerTime")}
            unit={isTimeLimitEnabled ? "sec" : undefined}
            action={
              <Switch
                checked={isTimeLimitEnabled}
                onCheckedChange={handleToggleTimeLimit}
              />
            }
          />
          {isTimeLimitEnabled && (
            <ConfigNumberInput
              value={currentQuestion.time}
              min={5}
              onChange={handleUpdateQuestion("time")}
            />
          )}
          <ConfigField.Description>
            {isTimeLimitEnabled
              ? t("quizz:question.config.answerTimeHint")
              : noTimeLimitHint}
          </ConfigField.Description>
        </ConfigField>
      </ConfigSection>
    </>
  )
}

export default BaseConfig
