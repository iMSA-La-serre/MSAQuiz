import type {
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import {
  acceptedCounts,
  isRecognized,
  namedAccepted,
  rankByCount,
  unrecognizedCount,
} from "@razzia/web/features/questions/shortanswer/utils/records"
import { describe, expect, it } from "vitest"

const record = (
  answerIds: number[] | null,
  text?: string | null,
): PlayerAnswerRecord => ({
  playerName: "Alice",
  answerIds,
  ...(text !== undefined && { text }),
})

const question = (playerAnswers: PlayerAnswerRecord[]): QuestionResult => ({
  type: "shortanswer",
  question: "Capitale de la France ?",
  answers: [],
  solutions: [],
  accepted: ["Paris", "Paname"],
  cooldown: 5,
  time: 40,
  playerAnswers,
})

const result = question([
  record([0], "paris"),
  record([1], "Paname"),
  record([0], "PARIS"),
  record([], "Lyon"),
  record(null, null),
])

describe("isRecognized", () => {
  it("needs an accepted answer recognized", () => {
    expect(isRecognized(record([0], "paris"))).toBe(true)
    expect(isRecognized(record([], "Lyon"))).toBe(false)
    expect(isRecognized(record(null, null))).toBe(false)
  })
})

describe("acceptedCounts", () => {
  it("counts the texts each accepted answer recognized", () => {
    expect(acceptedCounts(result)).toEqual([2, 1])
  })

  it("counts nothing without accepted answers", () => {
    expect(acceptedCounts({ ...result, accepted: undefined })).toEqual([])
  })
})

describe("unrecognizedCount", () => {
  it("counts the texts that matched nothing, not the missing answers", () => {
    expect(unrecognizedCount(result)).toBe(1)
  })
})

describe("rankByCount", () => {
  it("puts the largest count first and keeps ties in order", () => {
    expect(rankByCount([1, 3, 0, 3])).toEqual([1, 3, 0, 2])
  })

  it("does not change the counts it is given", () => {
    const counts = [0, 2]

    rankByCount(counts)

    expect(counts).toEqual([0, 2])
  })
})

describe("namedAccepted", () => {
  it("names the answers typed, the most typed first", () => {
    expect(namedAccepted([1, 0, 4, 0], 3)).toEqual({
      named: [2, 0],
      others: [],
    })
  })

  it("names the first answer even when nobody typed it", () => {
    expect(namedAccepted([0, 2, 0], 3)).toEqual({ named: [1, 0], others: [] })
    expect(namedAccepted([0, 0], 3)).toEqual({ named: [0], others: [] })
  })

  it("sums the least typed answers past the limit", () => {
    expect(namedAccepted([0, 5, 1, 3, 2], 3)).toEqual({
      named: [1, 3],
      others: [4, 2, 0],
    })
  })

  it("names nothing without accepted answers", () => {
    expect(namedAccepted([], 3)).toEqual({ named: [], others: [] })
  })
})
