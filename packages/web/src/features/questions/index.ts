import type {
  QuestionOptions,
  QuestionType,
  ScoringMode,
} from "@razzia/common/types/game"
import * as multi from "@razzia/web/features/questions/multi"
import * as poll from "@razzia/web/features/questions/poll"
import * as single from "@razzia/web/features/questions/single"
import * as slide from "@razzia/web/features/questions/slide"
import type {
  AnswerComponentProps,
  SolutionPickerProps,
} from "@razzia/web/features/questions/types"
import type { ComponentType } from "react"

interface QuestionRegistryEntry {
  labelKey: string
  defaultOptions?: QuestionOptions
  scoringModes?: ScoringMode[]
  AnswerComponent: ComponentType<AnswerComponentProps>
  ConfigComponent: ComponentType
  SolutionPicker: ComponentType<SolutionPickerProps>
}

export const QUESTION_REGISTRY: Record<QuestionType, QuestionRegistryEntry> = {
  single,
  multi,
  poll,
  slide,
}

export const QUESTION_TYPE_LIST = Object.keys(
  QUESTION_REGISTRY,
) as QuestionType[]
