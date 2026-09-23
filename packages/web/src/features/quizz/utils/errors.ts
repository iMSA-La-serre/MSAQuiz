import type { QuizzError } from "@razzia/common/types/game"
import type { TFunction } from "i18next"

/**
 * What the author reads when a save or an import is refused: the message,
 * after the number of the question at fault when it is about one (« Question
 * 3 : … » in the editor, « Import refusé, question 3 du fichier : … » for an
 * import, whose file is what to fix).
 */
export const quizzErrorText = (
  t: TFunction,
  error: string | QuizzError,
  questionKey = "errors:quizz.inQuestion",
): string => {
  if (typeof error === "string") {
    return t(error)
  }

  const message = t(error.message)

  return error.questionIndex === undefined
    ? message
    : t(questionKey, {
        number: error.questionIndex + 1,
        message,
      })
}

// The question at fault (0-based), for the editor to open it.
export const faultyQuestionOf = (
  error: string | QuizzError,
): number | undefined =>
  typeof error === "string" ? undefined : error.questionIndex
