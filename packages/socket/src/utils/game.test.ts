import { MAX_POINTS, QUESTION_TYPES } from "@razzia/common/constants"
import type { Question } from "@razzia/common/types/game"
import { orderToPoint, timeToPoint } from "@razzia/socket/utils/game"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The module also exports `withGame`, which reaches the game registry (and the
// database behind it). The helpers tested here are pure, so both are stubbed
// rather than booted.
vi.mock("@razzia/socket/services/game", () => ({ default: {} }))
vi.mock("@razzia/socket/services/registry", () => ({
  default: { getInstance: () => ({ getGameById: () => null }) },
}))

const question = (over: Partial<Question> = {}): Question => ({
  type: QUESTION_TYPES.SINGLE,
  question: "Quelle est la bonne réponse ?",
  answers: ["A", "B"],
  solutions: [0],
  cooldown: 5,
  time: 20,
  ...over,
})

describe("orderToPoint, used when a question has no time limit", () => {
  it("gives everything to a lone player", () => {
    expect(orderToPoint(0, 1)).toBe(MAX_POINTS)
  })

  it("gives everything to the first player", () => {
    expect(orderToPoint(0, 4)).toBe(MAX_POINTS)
  })

  it("gives half to the last player", () => {
    expect(orderToPoint(3, 4)).toBe(MAX_POINTS / 2)
  })

  it("spreads the rest linearly in between", () => {
    expect(orderToPoint(1, 3, 800)).toBe(600)
  })
})

describe("timeToPoint, used when a question has a time limit", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("gives everything to an instant answer", () => {
    expect(timeToPoint(0, question())).toBe(MAX_POINTS)
  })

  it("halves the points halfway through the answer window", () => {
    vi.setSystemTime(10_000)

    expect(timeToPoint(0, question({ time: 20 }))).toBe(MAX_POINTS / 2)
  })

  it("honours a custom maximum", () => {
    vi.setSystemTime(5_000)

    expect(timeToPoint(0, question({ time: 20, maxPoints: 400 }))).toBe(300)
  })

  it("never goes below zero once the window is over", () => {
    vi.setSystemTime(30_000)

    expect(timeToPoint(0, question({ time: 20 }))).toBe(0)
  })
})
