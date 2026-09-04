import { QUESTION_TYPES, SCORING_MODES } from "@razzia/common/constants"
import { quizzValidator } from "@razzia/common/validators/quizz"
import { describe, expect, it } from "vitest"

const SINGLE_QUESTION = {
  type: QUESTION_TYPES.SINGLE,
  question: "Quelle est la bonne réponse ?",
  answers: ["A", "B", "C", "D"],
  solutions: [0],
  cooldown: 5,
  time: 20,
}

const parse = (question: Record<string, unknown>) =>
  quizzValidator.parse({ subject: "Quiz", questions: [question] }).questions[0]

const isValid = (question: Record<string, unknown>) =>
  quizzValidator.safeParse({ subject: "Quiz", questions: [question] }).success

// A question written before the type system existed: no `type` field.
const { type: _type, ...LEGACY_QUESTION } = SINGLE_QUESTION

describe("legacy questions", () => {
  it("infers multi when several solutions are listed", () => {
    expect(parse({ ...LEGACY_QUESTION, solutions: [0, 2] }).type).toBe(
      QUESTION_TYPES.MULTI,
    )
  })

  it("infers single when only one solution is listed", () => {
    expect(parse(LEGACY_QUESTION).type).toBe(QUESTION_TYPES.SINGLE)
  })

  it("keeps an explicit type", () => {
    expect(parse({ ...SINGLE_QUESTION, type: QUESTION_TYPES.MULTI }).type).toBe(
      QUESTION_TYPES.MULTI,
    )
  })

  it("wraps a scalar solution into an array", () => {
    expect(parse({ ...SINGLE_QUESTION, solutions: 2 }).solutions).toEqual([2])
  })
})

describe("unscored types", () => {
  it("strips solutions and points tuning from a poll", () => {
    const poll = parse({
      ...SINGLE_QUESTION,
      type: QUESTION_TYPES.POLL,
      maxPoints: 1500,
      penalty: 200,
    })

    expect(poll.answers).toHaveLength(4)
    expect(poll.solutions).toEqual([])
    expect(poll.maxPoints).toBeUndefined()
    expect(poll.penalty).toBeUndefined()
  })

  it("drops the answers of a slide", () => {
    const slide = parse({ ...SINGLE_QUESTION, type: QUESTION_TYPES.SLIDE })

    expect(slide.answers).toEqual([])
    expect(slide.solutions).toEqual([])
  })

  it("accepts a slide without any answer", () => {
    expect(
      isValid({
        ...SINGLE_QUESTION,
        type: QUESTION_TYPES.SLIDE,
        answers: [],
        solutions: [],
      }),
    ).toBe(true)
  })
})

describe("fixed-answer types", () => {
  const trueFalse = {
    ...SINGLE_QUESTION,
    type: QUESTION_TYPES.TRUEFALSE,
    answers: ["Vrai", "Faux"],
    solutions: [0],
  }

  it("accepts exactly two answers", () => {
    expect(parse(trueFalse).answers).toEqual(["Vrai", "Faux"])
  })

  it("rejects a third answer", () => {
    expect(
      isValid({ ...trueFalse, answers: ["Vrai", "Faux", "Peut-être"] }),
    ).toBe(false)
  })

  it("still requires a solution", () => {
    expect(isValid({ ...trueFalse, solutions: [] })).toBe(false)
  })
})

describe("scoring options", () => {
  it("defaults the multi scoring mode to balanced", () => {
    const multi = parse({
      ...SINGLE_QUESTION,
      type: QUESTION_TYPES.MULTI,
      solutions: [0, 1],
      options: {},
    })

    expect(multi.options?.scoringMode).toBe(SCORING_MODES.BALANCED)
  })

  it("keeps an explicit scoring mode", () => {
    const multi = parse({
      ...SINGLE_QUESTION,
      type: QUESTION_TYPES.MULTI,
      solutions: [0, 1],
      options: { scoringMode: SCORING_MODES.STRICT },
    })

    expect(multi.options?.scoringMode).toBe(SCORING_MODES.STRICT)
  })
})

describe("rejected quizzes", () => {
  it("rejects a scored question without a solution", () => {
    expect(isValid({ ...SINGLE_QUESTION, solutions: [] })).toBe(false)
  })

  it("rejects fewer than two answers", () => {
    expect(isValid({ ...SINGLE_QUESTION, answers: ["A"] })).toBe(false)
  })

  it("rejects more than four answers", () => {
    expect(
      isValid({ ...SINGLE_QUESTION, answers: ["A", "B", "C", "D", "E"] }),
    ).toBe(false)
  })

  it("rejects an empty answer", () => {
    expect(isValid({ ...SINGLE_QUESTION, answers: ["A", ""] })).toBe(false)
  })

  it("rejects an empty question text", () => {
    expect(isValid({ ...SINGLE_QUESTION, question: "" })).toBe(false)
  })

  it("rejects a cooldown outside 3-15 seconds", () => {
    expect(isValid({ ...SINGLE_QUESTION, cooldown: 2 })).toBe(false)
    expect(isValid({ ...SINGLE_QUESTION, cooldown: 16 })).toBe(false)
  })

  it("rejects an unknown question type", () => {
    expect(isValid({ ...SINGLE_QUESTION, type: "buzzer" })).toBe(false)
  })

  it("rejects an invalid media url", () => {
    expect(
      isValid({
        ...SINGLE_QUESTION,
        media: { type: "image", url: "not-a-url" },
      }),
    ).toBe(false)
  })

  it("rejects an empty subject", () => {
    expect(
      quizzValidator.safeParse({ subject: "", questions: [SINGLE_QUESTION] })
        .success,
    ).toBe(false)
  })

  it("rejects a quiz without questions", () => {
    expect(
      quizzValidator.safeParse({ subject: "Quiz", questions: [] }).success,
    ).toBe(false)
  })
})

describe("accepted edge cases", () => {
  it("accepts -1 as no time limit", () => {
    expect(parse({ ...SINGLE_QUESTION, time: -1 }).time).toBe(-1)
  })

  it("accepts a media url", () => {
    const media = { type: "image", url: "https://example.org/image.png" }

    expect(parse({ ...SINGLE_QUESTION, media }).media?.url).toBe(media.url)
  })
})
