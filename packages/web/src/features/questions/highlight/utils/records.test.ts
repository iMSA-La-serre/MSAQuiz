import type {
  PlayerAnswerRecord,
  QuestionResult,
  ScoringMode,
} from "@razzia/common/types/game"
import { highlightScore } from "@razzia/web/features/questions/highlight/utils/records"
import { describe, expect, it } from "vitest"

const record = (
  answerIds: number[] | null,
  score?: number,
): PlayerAnswerRecord => ({
  playerName: "Alice",
  answerIds,
  ...(score !== undefined && { score }),
})

const question = (
  playerAnswers: PlayerAnswerRecord[],
  scoringMode?: ScoringMode,
): QuestionResult => ({
  type: "highlight",
  question: "Repérez les délais",
  text: "[sous 48 heures], [par courrier], [sous 3 jours]",
  answers: ["sous 48 heures", "par courrier", "sous 3 jours"],
  solutions: [0, 2],
  cooldown: 5,
  time: 45,
  playerAnswers,
  ...(scoringMode && { options: { scoringMode } }),
})

describe("highlightScore", () => {
  it("reads the multiplier saved with the result", () => {
    expect(highlightScore(question([]), record([0], 0.5))).toBe(0.5)
  })

  it("scores the passages again from the question's mode without one", () => {
    expect(highlightScore(question([]), record([2, 0]))).toBe(1)
    // Balanced when no mode is saved, as on the server.
    expect(highlightScore(question([]), record([0]))).toBe(0.5)
    expect(highlightScore(question([]), record([0, 1, 2]))).toBe(0.5)
    expect(highlightScore(question([], "strict"), record([0]))).toBe(0)
    // No lenient highlight: every passage tapped is not full credit.
    expect(highlightScore(question([], "lenient"), record([0, 1, 2]))).toBe(0.5)
  })

  it("gives nothing without an answer", () => {
    expect(highlightScore(question([]), record(null, 1))).toBe(0)
  })
})
