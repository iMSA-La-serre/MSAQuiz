import { QUESTION_TYPES } from "@razzia/common/constants"
import type { Question } from "@razzia/common/types/game"
import { randomInt } from "node:crypto"

// The answer list players are shown, and where each entry comes from:
// order[publicIndex] is the index of that entry in the question's answers.
export interface PublicAnswers {
  answers: string[]
  order: number[]
}

// Items a shuffled ordering may leave at their correct place: more would hand
// out part of the answer for free.
const MAX_ITEMS_IN_PLACE = 1

const itemsInPlace = (order: readonly number[]) =>
  order.filter((item, index) => item === index).length

// Fisher-Yates on a cryptographic source: nobody can predict the order from
// the previous draws.
const shuffle = (length: number): number[] => {
  const order = Array.from({ length }, (_, index) => index)

  for (let i = length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1)
    const swapped = order[i]

    order[i] = order[j]
    order[j] = swapped
  }

  return order
}

/** A random order of `length` items, with at most one item in place. */
export const drawPublicOrder = (length: number): number[] => {
  let order = shuffle(length)

  // About three draws in four pass from 3 items on: the loop ends quickly.
  while (itemsInPlace(order) > MAX_ITEMS_IN_PLACE) {
    order = shuffle(length)
  }

  return order
}

/**
 * Drawn once per question: every screen, and every reconnection, gets this
 * same list. An ordering is shuffled; a shortanswer shows no answers at all.
 */
export const toPublicAnswers = (question: Question): PublicAnswers => {
  if (question.type === QUESTION_TYPES.SHORTANSWER) {
    return { answers: [], order: [] }
  }

  const order =
    question.type === QUESTION_TYPES.ORDERING
      ? drawPublicOrder(question.answers.length)
      : question.answers.map((_, index) => index)

  return { answers: order.map((index) => question.answers[index]), order }
}
