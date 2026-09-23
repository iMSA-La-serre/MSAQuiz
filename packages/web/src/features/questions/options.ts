import type { QuestionOptions } from "@razzia/common/types/game"

/**
 * The multi scoring mode, the setting the result window shows next to the
 * time by default, whatever the type the question was saved with.
 */
export const scoringModeLabelKey = (
  options: QuestionOptions | undefined,
): string | null =>
  options?.scoringMode
    ? `quizz:question.config.scoringMode.${options.scoringMode}`
    : null

/**
 * The settings of a question without one of them, or none when nothing is
 * left but the scoring mode, which the validator fills in whenever options
 * are given and which a single choice or a poll never reads: turning a
 * setting on then off leaves the question as it was.
 */
export const withoutOption = (
  options: QuestionOptions | undefined,
  key: keyof QuestionOptions,
): QuestionOptions | undefined => {
  if (options === undefined) {
    return undefined
  }

  const rest = Object.fromEntries(
    Object.entries(options).filter(([name]) => name !== key),
  ) as QuestionOptions
  const kept = Object.keys(rest).filter((name) => name !== "scoringMode")

  return kept.length === 0 ? undefined : rest
}
