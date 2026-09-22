import type {
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import {
  orderingScore,
  placedCounts,
} from "@razzia/web/features/questions/ordering/utils/records"
import { describe, expect, it } from "vitest"

const question = (
  playerAnswers: PlayerAnswerRecord[],
  orderScoring?: "position" | "exact",
): QuestionResult => ({
  type: "ordering",
  question: "Du plus petit au plus grand",
  answers: ["Souris", "Chat", "Chien", "Cheval"],
  solutions: [],
  cooldown: 5,
  time: 30,
  ...(orderScoring && { options: { orderScoring } }),
  playerAnswers,
})

const record = (
  answerIds: number[] | null,
  score?: number,
): PlayerAnswerRecord => ({
  playerName: "Alice",
  answerIds,
  ...(score !== undefined && { score }),
})

describe("orderingScore", () => {
  it("reads the multiplier saved with the result", () => {
    expect(orderingScore(question([]), record([1, 0, 2, 3], 0.25))).toBe(0.25)
  })

  it("computes it again when the result has none", () => {
    expect(orderingScore(question([]), record([1, 0, 2, 3]))).toBe(0.5)
    expect(orderingScore(question([], "exact"), record([1, 0, 2, 3]))).toBe(0)
    expect(orderingScore(question([], "exact"), record([0, 1, 2, 3]))).toBe(1)
  })

  it("gives nothing without an answer", () => {
    expect(orderingScore(question([]), record(null))).toBe(0)
  })
})

describe("placedCounts", () => {
  it("counts, for each item, the players who put it at its place", () => {
    const result = question([
      record([0, 1, 2, 3]),
      record([1, 0, 2, 3]),
      record([0, 2, 1, 3]),
      record(null),
    ])

    expect(placedCounts(result)).toEqual([2, 1, 2, 3])
  })

  it("counts nothing without answers", () => {
    expect(placedCounts(question([record(null)]))).toEqual([0, 0, 0, 0])
  })
})
