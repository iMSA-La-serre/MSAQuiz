import { QUESTION_TYPES, SCORING_MODES } from "@razzia/common/constants"
import type { Question, QuestionType } from "@razzia/common/types/game"
import {
  isCreditStep,
  partialCredits,
  partialOutcomeOf,
  pollMultiple,
  publicOptions,
  storedCredits,
} from "@razzia/common/utils/choice"
import { describe, expect, it } from "vitest"

const question = (over: Partial<Question> = {}): Question => ({
  type: QUESTION_TYPES.SINGLE,
  question: "Combien de caisses régionales compte la MSA ?",
  answers: ["12", "35", "50", "101"],
  solutions: [1],
  cooldown: 5,
  time: 20,
  ...over,
})

describe("pollMultiple", () => {
  it("is on for a poll whose author allows several answers", () => {
    expect(
      pollMultiple({ type: QUESTION_TYPES.POLL, options: { multiple: true } }),
    ).toBe(true)
  })

  it("is off otherwise, and on any other type", () => {
    expect(pollMultiple({ type: QUESTION_TYPES.POLL })).toBe(false)
    expect(
      pollMultiple({ type: QUESTION_TYPES.POLL, options: { multiple: false } }),
    ).toBe(false)
    expect(
      pollMultiple({
        type: QUESTION_TYPES.MARKERS,
        options: { multiple: true },
      }),
    ).toBe(false)
  })
})

describe("isCreditStep", () => {
  it("takes 0, 25, 50 and 75 only", () => {
    expect([0, 25, 50, 75].every(isCreditStep)).toBe(true)
    expect(
      [100, 30, -25, 50.5, Number.NaN, "50", null].some(isCreditStep),
    ).toBe(false)
  })
})

describe("storedCredits", () => {
  it("gives one credit per answer, 100 for a right one", () => {
    expect(
      storedCredits(question({ options: { credits: [50, 0, 25, 0] } })),
    ).toEqual([50, 100, 25, 0])
  })

  it("reads a missing or broken credit as 0", () => {
    expect(
      storedCredits(
        question({
          options: { credits: [30, 100, "50", 75, 25] as unknown as number[] },
        }),
      ),
    ).toEqual([0, 100, 0, 75])
  })

  it("is null without credits, or on another type", () => {
    expect(storedCredits(question())).toBeNull()
    expect(
      storedCredits(
        question({
          type: QUESTION_TYPES.TRUEFALSE,
          options: { credits: [50] },
        }),
      ),
    ).toBeNull()
  })
})

describe("partialCredits", () => {
  it("gives the credits once a wrong answer earns part of the points", () => {
    expect(
      partialCredits(question({ options: { credits: [0, 100, 50, 0] } })),
    ).toEqual([0, 100, 50, 0])
  })

  it("is null when no wrong answer earns anything", () => {
    expect(
      partialCredits(question({ options: { credits: [0, 100, 0, 0] } })),
    ).toBeNull()
    expect(
      partialCredits(
        question({ solutions: [0, 1], options: { credits: [100, 100, 0] } }),
      ),
    ).toBeNull()
    expect(partialCredits(question())).toBeNull()
  })
})

describe("partialOutcomeOf", () => {
  it("follows the type's setting", () => {
    const types: QuestionType[] = [
      QUESTION_TYPES.ORDERING,
      QUESTION_TYPES.HIGHLIGHT,
      QUESTION_TYPES.STATEMENTS,
    ]

    for (const type of types) {
      expect(partialOutcomeOf(question({ type })), type).toBe(true)
    }

    expect(partialOutcomeOf(question({ type: QUESTION_TYPES.MULTI }))).toBe(
      false,
    )
  })

  it("turns on for a single choice with partial credits only", () => {
    expect(partialOutcomeOf(question())).toBe(false)
    expect(
      partialOutcomeOf(question({ options: { credits: [0, 100, 0, 0] } })),
    ).toBe(false)
    expect(
      partialOutcomeOf(question({ options: { credits: [25, 100, 0, 0] } })),
    ).toBe(true)
  })
})

describe("publicOptions", () => {
  it("leaves the credits out, with the scoring mode filled in along", () => {
    // A single choice without credits has no settings: one with credits
    // must not stand out by the scoring mode the validator added.
    expect(
      publicOptions({
        scoringMode: SCORING_MODES.BALANCED,
        credits: [50, 100, 0, 0],
      }),
    ).toBeUndefined()
    expect(publicOptions({ credits: [0, 100, 0, 0] })).toBeUndefined()
  })

  it("keeps any other setting sent along with the credits", () => {
    expect(
      publicOptions({
        scoringMode: SCORING_MODES.BALANCED,
        multiple: true,
        credits: [50, 100, 0, 0],
      }),
    ).toEqual({ scoringMode: SCORING_MODES.BALANCED, multiple: true })
  })

  it("gives the same settings when there is nothing to leave out", () => {
    const options = { scoringMode: SCORING_MODES.STRICT, multiple: true }

    expect(publicOptions(options)).toBe(options)
    expect(publicOptions(undefined)).toBeUndefined()
  })
})
