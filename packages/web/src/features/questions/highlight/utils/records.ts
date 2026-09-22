import type {
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import { scoreHighlight } from "@razzia/common/utils/highlight"

// A recorded highlight answer lists the passages tapped, as indices into the
// question's answers; the passages to spot are its solutions.

/**
 * Multiplier of a recorded answer: the one saved when the question closed,
 * or computed again from the question's scoring mode, as the server does.
 * 0 without an answer.
 */
export const highlightScore = (
  question: QuestionResult,
  record: PlayerAnswerRecord,
): number => {
  if (record.answerIds === null) {
    return 0
  }

  return (
    record.score ??
    scoreHighlight(
      record.answerIds,
      question.solutions,
      question.options?.scoringMode,
    )
  )
}
