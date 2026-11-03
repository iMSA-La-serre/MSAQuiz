import type { AnswerPayload } from "@razzia/common/types/game"
import { STATUS } from "@razzia/common/types/game/status"
import type { PendingAnswer } from "@razzia/web/features/game/stores/question"

// An answer reaches the server and comes back confirmed (WAIT) within a
// fraction of a second. Past this delay, the connection is likely dead
// without the phone knowing yet: it would only find out at the next
// heartbeat, up to 45 seconds later.
export const ANSWER_CONFIRM_TIMEOUT_MS = 3000

interface ReceivedStatus {
  name: string
  data: unknown
}

const questionNumberOf = ({ name, data }: ReceivedStatus): number | null => {
  if (name !== STATUS.SELECT_ANSWER || typeof data !== "object" || !data) {
    return null
  }

  const { questionNumber } = data as { questionNumber?: unknown }

  return typeof questionNumber === "number" ? questionNumber : null
}

/**
 * The answer to send again once the phone is back on a new connection: the
 * one it sent and the server never confirmed (the server then gives the
 * answers' screen back, not WAIT), while that same question still takes
 * answers. Null for any other screen or question.
 */
export const answerToResend = (
  pending: PendingAnswer | null,
  status: ReceivedStatus,
): AnswerPayload | null => {
  const questionNumber = questionNumberOf(status)

  return questionNumber !== null && questionNumber === pending?.questionNumber
    ? pending.answer
    : null
}

/**
 * The key of the screen a status shows. A new question's answers start
 * afresh, even when a reconnection brings them with nothing in between:
 * the same screen kept would hold the previous question's choice, its rows
 * still locked. The same question's keeps the choice made.
 */
export const statusKey = (status: ReceivedStatus): string => {
  const questionNumber = questionNumberOf(status)

  return questionNumber === null
    ? status.name
    : `${status.name}-${questionNumber}`
}
