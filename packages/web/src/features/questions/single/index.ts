import type { QuestionOptions, QuestionResult } from "@razzia/common/types/game"
import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import { partialCredits } from "@razzia/common/utils/choice"
import { creditsLabelKey } from "@razzia/web/features/questions/single/utils/credits"
import type { TFunction } from "i18next"

export { default as AnswerComponent } from "@razzia/web/features/questions/single/components/SingleAnswers"

export { default as ConfigComponent } from "@razzia/web/features/questions/single/components/SingleConfig"

export { default as SolutionPicker } from "@razzia/web/features/questions/single/components/SinglePicker"

export const labelKey = "quizz:questionType.single"

// Partial credits: the rows of the answers earning part of the points are
// labelled with their credit, and a note under the rows says what it stands
// for. No hint above them, as a single choice never had one: the title and
// the rows stay where the answering screen put them.
export const distributionAside = (
  t: TFunction,
  data: ManagerStatusDataMap["SHOW_RESPONSES"],
) => (partialCredits(data) ? t("game:responses.creditHint") : undefined)

// Partial credits, next to the time in the result window; otherwise the
// default (creditsLabelKey).
export const optionsLabelKey = (
  _options: QuestionOptions | undefined,
  question: QuestionResult,
): string | null => creditsLabelKey(question)
