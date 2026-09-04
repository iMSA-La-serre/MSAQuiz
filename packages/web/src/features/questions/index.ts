import type {
  QuestionOptions,
  QuestionType,
  ScoringMode,
} from "@razzia/common/types/game"
import * as multi from "@razzia/web/features/questions/multi"
import * as poll from "@razzia/web/features/questions/poll"
import * as single from "@razzia/web/features/questions/single"
import * as slide from "@razzia/web/features/questions/slide"
import * as truefalse from "@razzia/web/features/questions/truefalse"
import type {
  AnswerComponentProps,
  SolutionPickerProps,
} from "@razzia/web/features/questions/types"
import type { ComponentType } from "react"

interface QuestionRegistryEntry {
  labelKey: string
  defaultOptions?: QuestionOptions
  // Translation keys of the fixed answers imposed when the author picks this
  // type (true/false); see QUESTION_TYPE_META.answersCount.
  defaultAnswerKeys?: string[]
  scoringModes?: ScoringMode[]
  AnswerComponent: ComponentType<AnswerComponentProps>
  ConfigComponent: ComponentType
  SolutionPicker: ComponentType<SolutionPickerProps>
}

export const QUESTION_REGISTRY: Record<QuestionType, QuestionRegistryEntry> = {
  single,
  multi,
  truefalse,
  poll,
  slide,
}

export const QUESTION_TYPE_LIST = Object.keys(
  QUESTION_REGISTRY,
) as QuestionType[]
