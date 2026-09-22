import type {
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import {
  isRightValue,
  valueOf,
  valuesOf,
} from "@razzia/web/features/questions/estimate/utils/records"
import { describe, expect, it } from "vitest"

const record = (value: number | null, score?: number): PlayerAnswerRecord => ({
  playerName: "Alice",
  answerIds: value === null ? null : [],
  value,
  ...(score !== undefined && { score }),
})

const question = (playerAnswers: PlayerAnswerRecord[]): QuestionResult => ({
  type: "estimate",
  question: "Combien de caisses compte la MSA ?",
  answers: [],
  solutions: [],
  expected: 35,
  options: { tolerance: 2 },
  cooldown: 5,
  time: 30,
  playerAnswers,
})

describe("estimate records", () => {
  it("reads the number sent, or nothing", () => {
    expect(valueOf(record(36))).toBe(36)
    expect(valueOf(record(null))).toBeNull()
    expect(valueOf({ playerName: "Bob", answerIds: [] })).toBeNull()
  })

  it("lists every number sent", () => {
    expect(valuesOf(question([record(36), record(null), record(0)]))).toEqual([
      36, 0,
    ])
  })

  it("trusts the saved score, or the tolerance without one", () => {
    const result = question([])

    expect(isRightValue(result, record(40, 1))).toBe(true)
    expect(isRightValue(result, record(36, 0))).toBe(false)
    expect(isRightValue(result, record(37))).toBe(true)
    expect(isRightValue(result, record(38))).toBe(false)
    expect(isRightValue(result, record(null, 0))).toBe(false)
  })
})
