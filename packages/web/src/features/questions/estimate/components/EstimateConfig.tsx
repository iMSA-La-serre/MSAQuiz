import { ESTIMATE_LIMITS } from "@razzia/common/constants"
import type { QuestionOptions } from "@razzia/common/types/game"
import { decimalsOf } from "@razzia/common/utils/estimate"
import Input from "@razzia/web/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@razzia/web/components/Select"
import Switch from "@razzia/web/components/Switch"
import {
  draftNote,
  useNumberDraft,
} from "@razzia/web/features/questions/estimate/utils/draft"
import BaseConfig from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/BaseConfig"
import ConfigField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigSection from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import {
  ArrowDownToLine,
  ArrowUpToLine,
  DecimalsArrowRight,
  Ruler,
} from "lucide-react"
import { type ReactNode, useId } from "react"
import { useTranslation } from "react-i18next"

const DECIMALS = Array.from(
  { length: ESTIMATE_LIMITS.MAX_DECIMALS + 1 },
  (_, index) => index,
)

// The bound set when its switch is turned on.
const DEFAULT_BOUND = { min: 0, max: 100 }

interface BoundProps {
  bound: "min" | "max"
  icon: ReactNode
}

// A bound of the numbers players may send: off, or a number, as the penalty
// is off or a number of points.
const BoundField = ({ bound, icon }: BoundProps) => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const noteId = useId()
  const { options } = currentQuestion
  const value = options?.[bound]
  const enabled = value !== undefined

  const setBound = (next: number | undefined) => {
    const { [bound]: _previous, ...rest } = options ?? {}

    updateQuestion(currentIndex, {
      options: next === undefined ? rest : { ...rest, [bound]: next },
    })
  }

  const draft = useNumberDraft(value, setBound, { keepOnEmpty: true })
  const note = draftNote(t, {
    refusal: draft.refusal,
    value,
    decimals: decimalsOf(options),
  })

  return (
    <ConfigField>
      <ConfigField.Label
        icon={icon}
        label={t(`quizz:question.config.${bound}`)}
        action={
          <Switch
            aria-label={t(`quizz:question.config.${bound}`)}
            checked={enabled}
            onCheckedChange={(checked) => {
              const next = checked ? DEFAULT_BOUND[bound] : undefined

              draft.reset(next)
              setBound(next)
            }}
          />
        }
      />
      {/* An emptied field leaves the bound as it was: shown again on blur. */}
      {enabled && (
        <Input
          variant="sm"
          inputMode="decimal"
          value={draft.draft}
          onChange={(event) => draft.update(event.target.value)}
          onBlur={() => {
            if (draft.draft.trim() === "") {
              draft.reset(value)
            }
          }}
          aria-label={t(`quizz:question.config.${bound}`)}
          aria-invalid={note !== null}
          aria-describedby={note === null ? undefined : noteId}
          className="aria-invalid:border-danger w-full tabular-nums"
        />
      )}
      {note !== null && (
        <p id={noteId} className="text-danger text-xs font-semibold">
          {note}
        </p>
      )}
      <ConfigField.Description>
        {t(`quizz:question.config.${bound}Hint`)}
      </ConfigField.Description>
    </ConfigField>
  )
}

// The settings of the phone field come first, as a word cloud's: unit,
// decimals and bounds. The right value and the tolerance are in the answers
// block.
const EstimateConfig = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const { options } = currentQuestion
  const decimals = decimalsOf(options)

  const setOptions = (next: QuestionOptions) => {
    updateQuestion(currentIndex, { options: { ...options, ...next } })
  }

  return (
    <>
      <ConfigSection title={t("quizz:question.config.input")}>
        <ConfigField>
          <ConfigField.Label
            icon={<Ruler className="size-4" />}
            label={t("quizz:question.config.unit")}
          />
          <Input
            variant="sm"
            value={options?.unit ?? ""}
            maxLength={ESTIMATE_LIMITS.UNIT_LENGTH}
            placeholder={t("quizz:question.config.unitPlaceholder")}
            aria-label={t("quizz:question.config.unit")}
            onChange={(event) => setOptions({ unit: event.target.value })}
            className="w-full"
          />
          <ConfigField.Description>
            {t("quizz:question.config.unitHint", {
              max: ESTIMATE_LIMITS.UNIT_LENGTH,
            })}
          </ConfigField.Description>
        </ConfigField>

        <ConfigField>
          <ConfigField.Label
            icon={<DecimalsArrowRight className="size-4" />}
            label={t("quizz:question.config.decimals")}
          />
          <Select
            value={String(decimals)}
            onValueChange={(next) => setOptions({ decimals: Number(next) })}
          >
            <SelectTrigger aria-label={t("quizz:question.config.decimals")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DECIMALS.map((count) => (
                <SelectItem key={count} value={String(count)}>
                  {t(`quizz:estimate.decimalsValue.${count}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ConfigField.Description>
            {t("quizz:question.config.decimalsHint")}
          </ConfigField.Description>
        </ConfigField>

        {/* Keyed by question: the field keeps what is typed until it reads as
        a number, and must not carry it to the next question. */}
        <BoundField
          key={`${currentQuestion.id}-min`}
          bound="min"
          icon={<ArrowDownToLine className="size-4" />}
        />
        <BoundField
          key={`${currentQuestion.id}-max`}
          bound="max"
          icon={<ArrowUpToLine className="size-4" />}
        />
      </ConfigSection>
      <BaseConfig />
    </>
  )
}

export default EstimateConfig
