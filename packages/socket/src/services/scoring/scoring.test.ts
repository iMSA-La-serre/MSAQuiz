import { QUESTION_TYPES, SCORING_MODES } from "@razzia/common/constants"
import type { Question, ScoringMode } from "@razzia/common/types/game"
import { QUESTION_SCORING } from "@razzia/socket/services/scoring"
import { describe, expect, it } from "vitest"

const question = (over: Partial<Question> = {}): Question => ({
  type: QUESTION_TYPES.SINGLE,
  question: "Quelle est la bonne réponse ?",
  answers: ["A", "B", "C", "D"],
  solutions: [0],
  cooldown: 5,
  time: 20,
  ...over,
})

const scoreMulti = (
  scoringMode: ScoringMode,
  solutions: number[],
  answerIds: number[],
) =>
  QUESTION_SCORING.multi(
    question({
      type: QUESTION_TYPES.MULTI,
      solutions,
      options: { scoringMode },
    }),
    answerIds,
  )

describe("single", () => {
  const score = (solutions: number[], answerIds: number[]) =>
    QUESTION_SCORING.single(question({ solutions }), answerIds)

  it("gives full points for the expected answer", () => {
    expect(score([1], [1])).toBe(1)
  })

  it("gives nothing for a wrong answer", () => {
    expect(score([1], [2])).toBe(0)
  })

  it("gives nothing when no answer was submitted", () => {
    expect(score([1], [])).toBe(0)
  })

  it("gives nothing when several answers are submitted", () => {
    expect(score([1], [1, 2])).toBe(0)
  })

  it("accepts any of the solutions when several are listed", () => {
    expect(score([1, 3], [3])).toBe(1)
  })
})

describe("multi, strict mode", () => {
  const score = (solutions: number[], answerIds: number[]) =>
    scoreMulti(SCORING_MODES.STRICT, solutions, answerIds)

  it("gives full points for the exact set", () => {
    expect(score([0, 2], [2, 0])).toBe(1)
  })

  it("gives nothing when a solution is missing", () => {
    expect(score([0, 2], [0])).toBe(0)
  })

  it("gives nothing when a wrong answer is added", () => {
    expect(score([0, 2], [0, 2, 3])).toBe(0)
  })
})

describe("multi, balanced mode", () => {
  const score = (solutions: number[], answerIds: number[]) =>
    scoreMulti(SCORING_MODES.BALANCED, solutions, answerIds)

  it("gives full points for the exact set", () => {
    expect(score([0, 1, 2], [0, 1, 2])).toBe(1)
  })

  it("gives partial credit for a subset", () => {
    expect(score([0, 1, 2], [0, 1])).toBeCloseTo(2 / 3)
  })

  it("cancels a correct pick with a wrong one", () => {
    expect(score([0, 1, 2], [0, 3])).toBe(0)
  })

  it("never goes below zero", () => {
    expect(score([0], [1, 2, 3])).toBe(0)
  })
})

describe("multi, lenient mode", () => {
  const score = (solutions: number[], answerIds: number[]) =>
    scoreMulti(SCORING_MODES.LENIENT, solutions, answerIds)

  it("ignores wrong picks", () => {
    expect(score([0, 1, 2], [0, 3])).toBeCloseTo(1 / 3)
  })

  it("gives full points once every solution is picked", () => {
    expect(score([0, 1], [0, 1, 3])).toBe(1)
  })
})

describe("multi, default mode", () => {
  it("falls back to balanced when no option is set", () => {
    const balanced = QUESTION_SCORING.multi(
      question({ type: QUESTION_TYPES.MULTI, solutions: [0, 1, 2] }),
      [0, 1],
    )

    expect(balanced).toBeCloseTo(2 / 3)
  })
})

describe("truefalse", () => {
  const score = (solutions: number[], answerIds: number[]) =>
    QUESTION_SCORING.truefalse(
      question({
        type: QUESTION_TYPES.TRUEFALSE,
        answers: ["Vrai", "Faux"],
        solutions,
      }),
      answerIds,
    )

  it("gives full points for the expected side", () => {
    expect(score([1], [1])).toBe(1)
  })

  it("gives nothing for the other side", () => {
    expect(score([1], [0])).toBe(0)
  })

  it("gives nothing when both sides are submitted", () => {
    expect(score([1], [0, 1])).toBe(0)
  })
})

describe("unscored types", () => {
  it("never awards points for a poll vote", () => {
    expect(
      QUESTION_SCORING.poll(
        question({ type: QUESTION_TYPES.POLL, solutions: [] }),
        [0],
      ),
    ).toBe(0)
  })

  it("never awards points for a slide", () => {
    expect(
      QUESTION_SCORING.slide(
        question({ type: QUESTION_TYPES.SLIDE, answers: [], solutions: [] }),
        [],
      ),
    ).toBe(0)
  })
})
