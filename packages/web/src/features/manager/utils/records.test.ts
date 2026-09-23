import { QUESTION_TYPES, SCORING_MODES } from "@razzia/common/constants"
import type { QuestionResult } from "@razzia/common/types/game"
import {
  choiceVerdict,
  hasAnswer,
} from "@razzia/web/features/manager/utils/records"
import { describe, expect, it } from "vitest"

describe("hasAnswer", () => {
  it("reads a record with answer ids as answered", () => {
    expect(hasAnswer({ playerName: "Alice", answerIds: [1] })).toBe(true)
  })

  it("reads a missing answer as such", () => {
    expect(hasAnswer({ playerName: "Alice", answerIds: null })).toBe(false)
    expect(
      hasAnswer({ playerName: "Alice", answerIds: null, text: null }),
    ).toBe(false)
  })

  it("reads a text that matched nothing as answered", () => {
    expect(
      hasAnswer({ playerName: "Alice", answerIds: [], text: "Lyon" }),
    ).toBe(true)
  })

  it("keeps an empty id list without text unanswered, as before", () => {
    expect(hasAnswer({ playerName: "Alice", answerIds: [] })).toBe(false)
  })

  it("reads the participation of a word cloud, which keeps no answer", () => {
    expect(
      hasAnswer({ playerName: "Alice", answerIds: [], answered: true }),
    ).toBe(true)
    expect(
      hasAnswer({ playerName: "Alice", answerIds: null, answered: false }),
    ).toBe(false)
  })

  it("reads an estimate value as answered, even 0", () => {
    expect(hasAnswer({ playerName: "Alice", answerIds: [], value: 0 })).toBe(
      true,
    )
    expect(
      hasAnswer({ playerName: "Alice", answerIds: null, value: null }),
    ).toBe(false)
  })
})

describe("choiceVerdict", () => {
  const single = (
    over: Partial<QuestionResult> = {},
  ): Pick<QuestionResult, "type" | "answers" | "solutions" | "options"> => ({
    type: QUESTION_TYPES.SINGLE,
    answers: ["24 heures", "48 heures", "72 heures", "8 jours"],
    solutions: [1],
    ...over,
  })
  const credited = single({
    options: { scoringMode: SCORING_MODES.BALANCED, credits: [50, 100, 25, 0] },
  })
  const record = (answerIds: number[] | null, score?: number) => ({
    playerName: "camille",
    answerIds,
    ...(score !== undefined && { score }),
  })

  it("reads a scored choice right or wrong, a missing answer as wrong, as before", () => {
    expect(choiceVerdict(single(), record([1]))).toEqual({
      verdict: "correct",
    })
    expect(choiceVerdict(single(), record([0]))).toEqual({ verdict: "wrong" })
    expect(choiceVerdict(single(), record(null))).toEqual({ verdict: "wrong" })
    expect(
      choiceVerdict(
        single({ type: QUESTION_TYPES.MULTI, solutions: [0, 1] }),
        record([1, 3]),
      ),
    ).toEqual({ verdict: "correct" })
  })

  it("reads an answer earning part of the points as partly right", () => {
    expect(choiceVerdict(credited, record([0], 0.5))).toEqual({
      verdict: "partial",
      credit: 50,
    })
    // Saved without its multiplier: the credit of the answer picked.
    expect(choiceVerdict(credited, record([2]))).toEqual({
      verdict: "partial",
      credit: 25,
    })
    expect(choiceVerdict(credited, record([3], 0))).toEqual({
      verdict: "wrong",
    })
    expect(choiceVerdict(credited, record([1], 1))).toEqual({
      verdict: "correct",
    })
  })

  it("never reads a poll answer as wrong", () => {
    const poll = single({ type: QUESTION_TYPES.POLL, solutions: [] })

    expect(choiceVerdict(poll, record([0, 2], 0))).toEqual({
      verdict: "recorded",
    })
    expect(choiceVerdict(poll, record([1], 0))).toEqual({
      verdict: "recorded",
    })
    expect(choiceVerdict(poll, record(null, 0))).toEqual({
      verdict: "noAnswer",
    })
  })
})
