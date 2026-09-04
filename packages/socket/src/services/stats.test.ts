import { QUESTION_TYPES, SCORING_MODES } from "@razzia/common/constants"
import type {
  GameResult,
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import {
  aggregateQuestions,
  overallSuccessRate,
} from "@razzia/socket/services/stats"
import { describe, expect, it } from "vitest"

const answers = (
  ...records: Array<[string, number[] | null]>
): PlayerAnswerRecord[] =>
  records.map(([playerName, answerIds]) => ({ playerName, answerIds }))

const question = (over: Partial<QuestionResult> = {}): QuestionResult => ({
  type: QUESTION_TYPES.SINGLE,
  question: "Capitale de la France ?",
  answers: ["Paris", "Lyon", "Marseille", "Nice"],
  solutions: [0],
  cooldown: 5,
  time: 20,
  playerAnswers: [],
  ...over,
})

const game = (
  questions: QuestionResult[],
  date = "2026-09-01",
): GameResult => ({
  id: `game-${date}`,
  subject: "Quiz",
  date,
  players: [],
  questions,
})

describe("aggregateQuestions", () => {
  it("merges the same question across games", () => {
    const stats = aggregateQuestions([
      game([question({ playerAnswers: answers(["Alex", [0]]) })], "2026-09-02"),
      game([question({ playerAnswers: answers(["Bea", [1]]) })], "2026-09-01"),
    ])

    expect(stats).toHaveLength(1)
    expect(stats[0]).toMatchObject({
      gameCount: 2,
      answerCount: 2,
      correctCount: 1,
      missingCount: 0,
      successRate: 0.5,
    })
  })

  it("counts players who did not answer apart from the rate", () => {
    const stats = aggregateQuestions([
      game([
        question({
          playerAnswers: answers(["Alex", [0]], ["Bea", null], ["Cyd", []]),
        }),
      ]),
    ])

    expect(stats[0]).toMatchObject({
      answerCount: 1,
      missingCount: 2,
      correctCount: 1,
      successRate: 1,
    })
  })

  it("scores a multi question with its own mode", () => {
    const stats = aggregateQuestions([
      game([
        question({
          type: QUESTION_TYPES.MULTI,
          question: "Couleurs primaires ?",
          solutions: [0, 2],
          options: { scoringMode: SCORING_MODES.STRICT },
          // Exact set, partial set, wrong set: only the first one counts.
          playerAnswers: answers(
            ["Alex", [0, 2]],
            ["Bea", [0]],
            ["Cyd", [1, 3]],
          ),
        }),
      ]),
    ])

    expect(stats[0]).toMatchObject({ answerCount: 3, correctCount: 1 })
    expect(stats[0].successRate).toBeCloseTo(1 / 3)
  })

  it("leaves a poll unrated but keeps its distribution", () => {
    const stats = aggregateQuestions([
      game([
        question({
          type: QUESTION_TYPES.POLL,
          question: "Quel créneau ?",
          answers: ["Matin", "Soir"],
          solutions: [],
          playerAnswers: answers(["Alex", [1]], ["Bea", [1]], ["Cyd", [0]]),
        }),
      ]),
    ])

    expect(stats[0]).toMatchObject({
      scored: false,
      successRate: null,
      correctCount: 0,
      answerCount: 3,
    })
    expect(stats[0].answers).toEqual([
      { label: "Soir", count: 2 },
      { label: "Matin", count: 1 },
    ])
  })

  it("reports the wording of the correct answers", () => {
    const stats = aggregateQuestions([
      game([question({ playerAnswers: answers(["Alex", [1]]) })]),
    ])

    expect(stats[0].solutionLabels).toEqual(["Paris"])
    // The expected answer stays listed even though nobody picked it.
    expect(stats[0].answers).toEqual([
      { label: "Paris", count: 0 },
      { label: "Lyon", count: 1 },
    ])
  })

  it("puts the hardest questions first and the unrated ones last", () => {
    const stats = aggregateQuestions([
      game([
        question({
          question: "Facile",
          playerAnswers: answers(["Alex", [0]], ["Bea", [0]]),
        }),
        question({
          question: "Difficile",
          playerAnswers: answers(["Alex", [1]], ["Bea", [0]]),
        }),
        question({
          type: QUESTION_TYPES.POLL,
          question: "Sondage",
          solutions: [],
          playerAnswers: answers(["Alex", [0]]),
        }),
      ]),
    ])

    expect(stats.map((s) => s.question)).toEqual([
      "Difficile",
      "Facile",
      "Sondage",
    ])
  })
})

describe("overallSuccessRate", () => {
  it("averages over the answers given to scored questions", () => {
    const stats = aggregateQuestions([
      game([
        question({
          question: "Facile",
          playerAnswers: answers(["Alex", [0]], ["Bea", [0]]),
        }),
        question({
          question: "Difficile",
          playerAnswers: answers(["Alex", [1]], ["Bea", [1]]),
        }),
      ]),
    ])

    expect(overallSuccessRate(stats)).toBe(0.5)
  })

  it("has nothing to average when no scored question was answered", () => {
    const stats = aggregateQuestions([
      game([
        question({
          type: QUESTION_TYPES.POLL,
          solutions: [],
          playerAnswers: answers(["Alex", [0]]),
        }),
      ]),
    ])

    expect(overallSuccessRate(stats)).toBeNull()
  })
})
