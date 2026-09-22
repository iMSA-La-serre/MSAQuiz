import type { QuestionResult } from "@razzia/common/types/game"
import {
  firstChoices,
  rankOrder,
  rankPoints,
} from "@razzia/common/utils/ranking"

// A recorded ranking lists the proposals by priority, as original indices;
// the room's order comes from the rank points of every answer.

export interface RankedItem {
  // Index of the proposal in the question's answers, which is its letter.
  index: number
  label: string
  points: number
  // Players who put it first.
  first: number
}

/** The orders sent, one per player who ranked the proposals. */
export const rankedOrders = (question: QuestionResult): number[][] =>
  question.playerAnswers.flatMap(({ answerIds }) =>
    answerIds === null || answerIds.length === 0 ? [] : [answerIds],
  )

/** The proposals in the room's order, the most important first. */
export const rankedItems = (question: QuestionResult): RankedItem[] => {
  const orders = rankedOrders(question)
  const { length } = question.answers
  const points = rankPoints(orders, length)
  const first = firstChoices(orders, length)

  return rankOrder(points).map((index) => ({
    index,
    label: question.answers[index],
    points: points[index],
    first: first[index],
  }))
}
