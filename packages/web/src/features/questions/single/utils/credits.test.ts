import { SCORING_MODES } from "@razzia/common/constants"
import type { Question } from "@razzia/common/types/game"
import {
  creditOf,
  creditsForSolutions,
  creditsLabelKey,
  creditsWithout,
  formatCredit,
  initialCredits,
  withCredit,
} from "@razzia/web/features/questions/single/utils/credits"
import { describe, expect, it } from "vitest"

const question = (
  credits?: number[],
  solutions = [1],
): Pick<Question, "answers" | "solutions" | "options"> => ({
  answers: ["12", "35", "50", "101"],
  solutions,
  ...(credits && { options: { credits } }),
})

describe("formatCredit", () => {
  it("writes a percentage as the screens do", () => {
    expect(formatCredit("fr", 50)).toMatch(/^50\s%$/u)
    expect(formatCredit("fr", 0)).toMatch(/^0\s%$/u)
  })
})

describe("creditOf", () => {
  it("gives a right answer 100 and a wrong one its step", () => {
    expect(creditOf(question([0, 0, 25, 0]), 1)).toBe(100)
    expect(creditOf(question([0, 0, 25, 0]), 2)).toBe(25)
  })

  it("reads a missing credit, or one that is no step, as 0", () => {
    expect(creditOf(question([0, 0]), 3)).toBe(0)
    expect(creditOf(question([100, 100, 30, 0]), 0)).toBe(0)
    expect(creditOf(question(), 2)).toBe(0)
  })
})

describe("initialCredits", () => {
  it("starts from nothing for the wrong answers", () => {
    expect(initialCredits(question(undefined, [1, 3]))).toEqual([
      0, 100, 0, 100,
    ])
  })
})

describe("withCredit", () => {
  it("changes one credit and keeps the others", () => {
    expect(withCredit(question([0, 100, 25]), 0, 75)).toEqual([75, 100, 25, 0])
  })
})

describe("creditsForSolutions", () => {
  it("gives a newly right answer all the points", () => {
    expect(creditsForSolutions(question([50, 100, 25, 0]), [1, 2])).toEqual([
      50, 100, 100, 0,
    ])
  })

  it("starts an answer that is no longer right again from 0", () => {
    expect(
      creditsForSolutions(question([50, 100, 100, 0], [1, 2]), [1]),
    ).toEqual([50, 100, 0, 0])
  })
})

describe("creditsWithout", () => {
  it("moves the following credits up", () => {
    expect(creditsWithout([50, 100, 25, 0], 1)).toEqual([50, 25, 0])
  })
})

describe("creditsLabelKey", () => {
  const stored = (credits: number[]) => ({
    ...question(),
    options: { scoringMode: SCORING_MODES.BALANCED, credits },
  })

  it("names partial credit once a wrong answer earns part of the points", () => {
    expect(creditsLabelKey(stored([50, 100, 0, 0]))).toBe(
      "quizz:question.config.credits",
    )
  })

  it("names nothing when every wrong answer is left at 0", () => {
    // Not the scoring mode stored along, meaningless on a single choice.
    expect(creditsLabelKey(stored([0, 100, 0, 0]))).toBeNull()
  })

  it("keeps the default without credits, as before", () => {
    expect(creditsLabelKey(question())).toBeNull()
    expect(
      creditsLabelKey({
        ...question(),
        options: { scoringMode: SCORING_MODES.BALANCED },
      }),
    ).toBe("quizz:question.config.scoringMode.balanced")
  })
})
