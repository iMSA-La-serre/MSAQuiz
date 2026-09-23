import { QUESTION_TYPES } from "@razzia/common/constants"
import type { QuestionOptions } from "@razzia/common/types/game"
import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import { pollMultiple } from "@razzia/common/utils/choice"
import { scoringModeLabelKey } from "@razzia/web/features/questions/options"
import type { TFunction } from "i18next"
import { Vote } from "lucide-react"

// One tap is one vote, as on a single choice, or several ticks then
// « Valider », as on a multiple choice, when the author allows several
// answers: the grids of those types rather than a copy.
export { default as AnswerComponent } from "@razzia/web/features/questions/poll/components/PollAnswers"

export { default as ConfigComponent } from "@razzia/web/features/questions/poll/components/PollConfig"

export { default as SolutionPicker } from "@razzia/web/features/questions/poll/components/PollPicker"

export const labelKey = "quizz:questionType.poll"

const isMultiple = (options: QuestionOptions | undefined): boolean =>
  pollMultiple({ type: QUESTION_TYPES.POLL, options })

// Several answers allowed: the phone says so, in place of the fixed hint.
export const answerHint = (
  t: TFunction,
  options: QuestionOptions | undefined,
): string =>
  t(
    isMultiple(options)
      ? "game:answer.pollHintMultiple"
      : "game:answer.pollHint",
  )

// Several answers allowed: each bar counts the players who ticked that
// answer, out of every player who answered, so the shares may add up to more
// than 100 %. The hint says so; otherwise, the fixed one.
export const distributionHint = (
  t: TFunction,
  data: ManagerStatusDataMap["SHOW_RESPONSES"],
) =>
  pollMultiple(data)
    ? { icon: Vote, text: t("game:responses.pollMultipleHint") }
    : undefined

// Several answers allowed, next to the time in the result window; otherwise
// the default, as before polls could take several.
export const optionsLabelKey = (
  options: QuestionOptions | undefined,
): string | null =>
  isMultiple(options)
    ? "quizz:question.config.pollMultipleShort"
    : scoringModeLabelKey(options)
