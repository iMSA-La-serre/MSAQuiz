import type {
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import {
  associationScore,
  matchedCounts,
} from "@razzia/web/features/questions/association/utils/records"
import { describe, expect, it } from "vitest"

const question = (
  playerAnswers: PlayerAnswerRecord[],
  matchScoring?: "share" | "exact",
): QuestionResult => ({
  type: "categorize",
  question: "Quelle branche verse chaque prestation ?",
  answers: ["Allocations familiales", "Pension", "Indemnités"],
  solutions: [],
  targets: ["Famille", "Retraite", "Maladie"],
  expectedTargets: [0, 1, 2],
  cooldown: 5,
  time: 30,
  ...(matchScoring && {
    options: { scoringMode: "balanced", matchScoring },
  }),
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

describe("associationScore", () => {
  it("reads the multiplier saved with the result", () => {
    expect(associationScore(question([]), record([0, 0, 0], 0.25))).toBe(0.25)
  })

  it("computes it again when the result has none", () => {
    expect(associationScore(question([]), record([0, 1, 0]))).toBeCloseTo(2 / 3)
    expect(associationScore(question([], "exact"), record([0, 1, 0]))).toBe(0)
  })

  it("gives nothing without an answer", () => {
    expect(associationScore(question([]), record(null, 1))).toBe(0)
  })
})

describe("matchedCounts", () => {
  it("counts the players who matched each item", () => {
    expect(
      matchedCounts(
        question([record([0, 1, 2]), record([0, 2, 2]), record(null)]),
      ),
    ).toEqual([2, 1, 2])
  })
})
