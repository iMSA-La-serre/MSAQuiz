import { QUESTION_TYPES, SHORTANSWER_LIMITS } from "@razzia/common/constants"
import type { Question } from "@razzia/common/types/game"
import { placedItems } from "@razzia/common/utils/ordering"
import {
  cleanInput,
  countInputChars,
  matchAccepted,
} from "@razzia/common/utils/text"
import type { ScoredAnswer } from "@razzia/socket/services/scoring"

// Answer ids as sent by a player, checked against the question before they
// are stored. The scoring counts matching ids, so a repeated id would be
// credited once per copy: duplicates are dropped, and anything a regular
// client cannot send (unknown answer, several picks on a single choice) is
// refused with null.
export const parseAnswerIds = (
  question: Question,
  answerIds: unknown,
): number[] | null => {
  if (!Array.isArray(answerIds)) {
    return null
  }

  const ids = [...new Set<unknown>(answerIds)]
  const inRange = ids.every(
    (id) =>
      Number.isInteger(id) &&
      (id as number) >= 0 &&
      (id as number) < question.answers.length,
  )

  if (ids.length === 0 || !inRange) {
    return null
  }

  if (question.type !== QUESTION_TYPES.MULTI && ids.length > 1) {
    return null
  }

  return ids as number[]
}

// Ordering: indices into the public list, in the order the player chose. Only
// an exact permutation of that list is kept, remapped to the original
// indices; a repeated index is refused rather than dropped, it would place one
// item twice.
const parseOrder = (
  answerKeys: unknown,
  publicOrder: readonly number[],
): number[] | null => {
  if (!Array.isArray(answerKeys)) {
    return null
  }

  const keys: unknown[] = answerKeys
  const { length } = publicOrder
  const isPermutation =
    keys.length === length &&
    new Set(keys).size === length &&
    keys.every(
      (key) =>
        Number.isInteger(key) &&
        (key as number) >= 0 &&
        (key as number) < length,
    )

  if (!isPermutation) {
    return null
  }

  return (keys as number[]).map((key) => publicOrder[key])
}

// Shortanswer: the text is cleaned and matched right away, only the cleaned
// input is kept. An empty or too long input is refused.
const parseText = (question: Question, text: unknown): ScoredAnswer | null => {
  if (typeof text !== "string") {
    return null
  }

  const length = countInputChars(text)

  if (length === 0 || length > SHORTANSWER_LIMITS.INPUT_LENGTH) {
    return null
  }

  const cleaned = cleanInput(text)
  const index = matchAccepted(question.accepted ?? [], cleaned, {
    typoTolerance: question.options?.typoTolerance,
  })

  return { answerIds: index === -1 ? [] : [index], text: cleaned }
}

const payloadField = (payload: unknown, field: string): unknown =>
  typeof payload === "object" &&
  payload !== null &&
  Object.hasOwn(payload, field)
    ? (payload as Record<string, unknown>)[field]
    : undefined

/**
 * An answer payload checked against the question, ready to be stored, or
 * null to ignore it. `publicOrder` maps each index of the list players were
 * shown to its original index (identity except for an ordering).
 */
export const parseAnswer = (
  question: Question,
  payload: unknown,
  publicOrder: readonly number[],
): ScoredAnswer | null => {
  if (question.type === QUESTION_TYPES.SHORTANSWER) {
    return parseText(question, payloadField(payload, "text"))
  }

  const answerKeys = payloadField(payload, "answerKeys")
  const answerIds =
    question.type === QUESTION_TYPES.ORDERING
      ? parseOrder(answerKeys, publicOrder)
      : parseAnswerIds(question, answerKeys)

  return answerIds && { answerIds }
}

/**
 * Tally shown with SHOW_RESPONSES, keyed by index. Choice types: votes per
 * answer. Ordering: players who put item i (original index) at its place.
 * Shortanswer: inputs recognized per accepted answer.
 */
export const countResponses = (
  question: Question,
  answers: readonly ScoredAnswer[],
): Record<number, number> => {
  const ids =
    question.type === QUESTION_TYPES.ORDERING
      ? answers.flatMap(({ answerIds }) =>
          placedItems(answerIds, question.answers.length).flatMap(
            (placed, index) => (placed ? [index] : []),
          ),
        )
      : answers.flatMap(({ answerIds }) => answerIds)

  return ids.reduce<Record<number, number>>((acc, id) => {
    acc[id] = (acc[id] ?? 0) + 1

    return acc
  }, {})
}
