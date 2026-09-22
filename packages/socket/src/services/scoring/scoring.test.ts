import {
  MATCH_SCORING,
  ORDER_SCORING,
  QUESTION_TYPES,
  SCORING_MODES,
} from "@razzia/common/constants"
import type {
  OrderScoring,
  Question,
  ScoringMode,
} from "@razzia/common/types/game"
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
    { answerIds },
  )

describe("single", () => {
  const score = (solutions: number[], answerIds: number[]) =>
    QUESTION_SCORING.single(question({ solutions }), { answerIds })

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
      { answerIds: [0, 1] },
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
      { answerIds },
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
        { answerIds: [0] },
      ),
    ).toBe(0)
  })

  it("never awards points for a slide", () => {
    expect(
      QUESTION_SCORING.slide(
        question({ type: QUESTION_TYPES.SLIDE, answers: [], solutions: [] }),
        { answerIds: [] },
      ),
    ).toBe(0)
  })
})

describe("ordering", () => {
  const ordering = (orderScoring?: OrderScoring) =>
    question({
      type: QUESTION_TYPES.ORDERING,
      answers: ["Un", "Deux", "Trois", "Quatre"],
      solutions: [],
      ...(orderScoring && { options: { orderScoring } }),
    })

  it("credits the share of items at their place by default", () => {
    expect(
      QUESTION_SCORING.ordering(ordering(), { answerIds: [0, 1, 3, 2] }),
    ).toBe(0.5)
  })

  it("gives full credit for the correct order", () => {
    expect(
      QUESTION_SCORING.ordering(ordering(), { answerIds: [0, 1, 2, 3] }),
    ).toBe(1)
  })

  it("gives nothing short of the exact order in exact mode", () => {
    const exact = ordering(ORDER_SCORING.EXACT)

    expect(QUESTION_SCORING.ordering(exact, { answerIds: [0, 1, 3, 2] })).toBe(
      0,
    )
    expect(QUESTION_SCORING.ordering(exact, { answerIds: [0, 1, 2, 3] })).toBe(
      1,
    )
  })
})

describe("shortanswer", () => {
  const shortanswer = question({
    type: QUESTION_TYPES.SHORTANSWER,
    answers: [],
    solutions: [],
    accepted: ["Paris"],
  })

  it("gives full credit to a recognized input", () => {
    expect(
      QUESTION_SCORING.shortanswer(shortanswer, {
        answerIds: [0],
        text: "paris",
      }),
    ).toBe(1)
  })

  it("gives nothing to an input that matched no accepted answer", () => {
    expect(
      QUESTION_SCORING.shortanswer(shortanswer, {
        answerIds: [],
        text: "Lyon",
      }),
    ).toBe(0)
  })
})

describe("estimate", () => {
  const estimate = question({
    type: QUESTION_TYPES.ESTIMATE,
    answers: [],
    solutions: [],
    expected: 35,
    options: { tolerance: 2 },
  })

  it("gives full credit within the tolerance, bounds included", () => {
    for (const value of [33, 35, 37]) {
      expect(
        QUESTION_SCORING.estimate(estimate, { answerIds: [], value }),
      ).toBe(1)
    }
  })

  it("gives nothing beyond the tolerance, or without a value", () => {
    expect(
      QUESTION_SCORING.estimate(estimate, { answerIds: [], value: 38 }),
    ).toBe(0)
    expect(QUESTION_SCORING.estimate(estimate, { answerIds: [] })).toBe(0)
  })
})

describe("highlight", () => {
  // Five passages, the most a highlight has: E, the last, is at index 4.
  const score = (
    scoringMode: ScoringMode,
    solutions: number[],
    answerIds: number[],
  ) =>
    QUESTION_SCORING.highlight(
      question({
        type: QUESTION_TYPES.HIGHLIGHT,
        answers: ["un", "deux", "trois", "quatre", "cinq"],
        text: "[un] [deux] [trois] [quatre] [cinq]",
        solutions,
        options: { scoringMode },
      }),
      { answerIds },
    )

  it("scores the passages tapped as the answers of a multi", () => {
    for (const mode of [SCORING_MODES.STRICT, SCORING_MODES.BALANCED]) {
      for (const answerIds of [
        [0, 4],
        [0],
        [0, 1, 4],
        [2, 3],
        [0, 1, 2, 3, 4],
      ]) {
        expect(score(mode, [0, 4], answerIds)).toBe(
          scoreMulti(mode, [0, 4], answerIds),
        )
      }
    }
  })

  it("gives partial credit in the balanced mode, up to the fifth passage", () => {
    expect(score(SCORING_MODES.BALANCED, [2, 4], [2, 4])).toBe(1)
    expect(score(SCORING_MODES.BALANCED, [2, 4], [2, 3, 4])).toBe(0.5)
    expect(score(SCORING_MODES.BALANCED, [2, 4], [4])).toBe(0.5)
    expect(score(SCORING_MODES.STRICT, [2, 4], [2, 4])).toBe(1)
    expect(score(SCORING_MODES.STRICT, [2, 4], [2, 3, 4])).toBe(0)
  })

  it("scores the lenient mode as balanced: tapping every passage is not full credit", () => {
    for (const answerIds of [[0, 4], [0], [0, 1, 4], [0, 1, 2, 3, 4]]) {
      expect(score(SCORING_MODES.LENIENT, [0, 4], answerIds)).toBe(
        score(SCORING_MODES.BALANCED, [0, 4], answerIds),
      )
    }

    expect(score(SCORING_MODES.LENIENT, [0, 1], [0, 1, 2, 3, 4])).toBe(0)
  })
})

describe("statements and categorize", () => {
  const STATEMENTS = question({
    type: QUESTION_TYPES.STATEMENTS,
    answers: ["Un", "Deux", "Trois", "Quatre"],
    solutions: [],
    targets: ["Vrai", "Faux"],
    expectedTargets: [0, 1, 1, 0],
  })
  const CATEGORIZE = question({
    type: QUESTION_TYPES.CATEGORIZE,
    answers: ["Un", "Deux", "Trois"],
    solutions: [],
    targets: ["Famille", "Retraite", "Maladie"],
    expectedTargets: [2, 0, 1],
  })

  it("gives the share of items matched with their right target", () => {
    expect(
      QUESTION_SCORING.statements(STATEMENTS, { answerIds: [0, 1, 1, 0] }),
    ).toBe(1)
    expect(
      QUESTION_SCORING.statements(STATEMENTS, { answerIds: [0, 1, 0, 1] }),
    ).toBe(0.5)
    expect(
      QUESTION_SCORING.categorize(CATEGORIZE, { answerIds: [2, 1, 0] }),
    ).toBeCloseTo(1 / 3)
  })

  it("gives all or nothing when the scoring is exact", () => {
    const exact = { options: { matchScoring: MATCH_SCORING.EXACT } }

    expect(
      QUESTION_SCORING.statements(
        { ...STATEMENTS, ...exact },
        { answerIds: [0, 1, 1, 1] },
      ),
    ).toBe(0)
    expect(
      QUESTION_SCORING.categorize(
        { ...CATEGORIZE, ...exact },
        { answerIds: [2, 0, 1] },
      ),
    ).toBe(1)
  })

  it("gives nothing without right targets to compare with", () => {
    expect(
      QUESTION_SCORING.statements(
        { ...STATEMENTS, expectedTargets: undefined },
        { answerIds: [0, 1, 1, 0] },
      ),
    ).toBe(0)
  })
})
