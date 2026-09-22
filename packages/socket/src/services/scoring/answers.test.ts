import { QUESTION_TYPES } from "@razzia/common/constants"
import type { Question, QuestionType } from "@razzia/common/types/game"
import {
  countResponses,
  parseAnswer,
  parseAnswerIds,
} from "@razzia/socket/services/scoring/answers"
import { describe, expect, it } from "vitest"

const question = (type: QuestionType, answers = ["A", "B", "C", "D"]) =>
  ({
    type,
    question: "Quelle est la bonne réponse ?",
    answers,
    solutions: [0, 1],
    cooldown: 5,
    time: 20,
  }) satisfies Question

describe("parseAnswerIds", () => {
  it("keeps what a regular client sends", () => {
    expect(parseAnswerIds(question(QUESTION_TYPES.SINGLE), [2])).toEqual([2])
    expect(parseAnswerIds(question(QUESTION_TYPES.MULTI), [0, 3])).toEqual([
      0, 3,
    ])
    expect(parseAnswerIds(question(QUESTION_TYPES.POLL), [1])).toEqual([1])
    expect(
      parseAnswerIds(question(QUESTION_TYPES.TRUEFALSE, ["Vrai", "Faux"]), [1]),
    ).toEqual([1])
  })

  it("drops repeated ids, which the scoring would credit once per copy", () => {
    expect(
      parseAnswerIds(question(QUESTION_TYPES.MULTI), [0, 0, 0, 0, 1, 1]),
    ).toEqual([0, 1])
    expect(parseAnswerIds(question(QUESTION_TYPES.SINGLE), [2, 2])).toEqual([2])
  })

  it("refuses ids outside the answers of the question", () => {
    expect(parseAnswerIds(question(QUESTION_TYPES.MULTI), [0, 4])).toBeNull()
    expect(parseAnswerIds(question(QUESTION_TYPES.SINGLE), [-1])).toBeNull()
    expect(
      parseAnswerIds(question(QUESTION_TYPES.TRUEFALSE, ["Vrai", "Faux"]), [2]),
    ).toBeNull()
  })

  it("refuses ids that are not integers", () => {
    expect(parseAnswerIds(question(QUESTION_TYPES.SINGLE), [1.5])).toBeNull()
    expect(parseAnswerIds(question(QUESTION_TYPES.SINGLE), ["1"])).toBeNull()
    expect(parseAnswerIds(question(QUESTION_TYPES.SINGLE), [null])).toBeNull()
  })

  it("refuses an empty answer or something that is not a list", () => {
    expect(parseAnswerIds(question(QUESTION_TYPES.MULTI), [])).toBeNull()
    expect(parseAnswerIds(question(QUESTION_TYPES.SINGLE), 1)).toBeNull()
    expect(
      parseAnswerIds(question(QUESTION_TYPES.SINGLE), undefined),
    ).toBeNull()
  })

  it("refuses several picks on a single-answer question", () => {
    expect(parseAnswerIds(question(QUESTION_TYPES.SINGLE), [0, 1])).toBeNull()
    expect(parseAnswerIds(question(QUESTION_TYPES.POLL), [0, 1])).toBeNull()
    expect(
      parseAnswerIds(
        question(QUESTION_TYPES.TRUEFALSE, ["Vrai", "Faux"]),
        [0, 1],
      ),
    ).toBeNull()
  })
})

describe("parseAnswer, choice types", () => {
  const identity = [0, 1, 2, 3]

  it("keeps the rules of parseAnswerIds", () => {
    expect(
      parseAnswer(
        question(QUESTION_TYPES.MULTI),
        { answerKeys: [0, 0, 3] },
        identity,
      ),
    ).toEqual({ answerIds: [0, 3] })
    expect(
      parseAnswer(
        question(QUESTION_TYPES.SINGLE),
        { answerKeys: [4] },
        identity,
      ),
    ).toBeNull()
  })

  it("refuses a text", () => {
    expect(
      parseAnswer(question(QUESTION_TYPES.SINGLE), { text: "A" }, identity),
    ).toBeNull()
  })
})

describe("parseAnswer, ordering", () => {
  const ordering = question(QUESTION_TYPES.ORDERING, ["Un", "Deux", "Trois"])
  // The players saw "Trois", "Un", "Deux".
  const publicOrder = [2, 0, 1]
  const parse = (payload: unknown) =>
    parseAnswer(ordering, payload, publicOrder)

  it("maps the indices of the shown list back to the original items", () => {
    // Tapped "Un", "Deux", "Trois": the correct order.
    expect(parse({ answerKeys: [1, 2, 0] })).toEqual({ answerIds: [0, 1, 2] })
    // Kept the shown order.
    expect(parse({ answerKeys: [0, 1, 2] })).toEqual({ answerIds: [2, 0, 1] })
  })

  it("refuses anything but a permutation of the shown list", () => {
    // A repeated index is refused, not dropped.
    expect(parse({ answerKeys: [0, 0, 1] })).toBeNull()
    expect(parse({ answerKeys: [0, 1] })).toBeNull()
    expect(parse({ answerKeys: [0, 1, 2, 3] })).toBeNull()
    expect(parse({ answerKeys: [0, 1, 3] })).toBeNull()
    expect(parse({ answerKeys: [0, 1, 1.5] })).toBeNull()
    expect(parse({ answerKeys: [0, 1, -1] })).toBeNull()
    expect(parse({ answerKeys: "012" })).toBeNull()
    expect(parse({ text: "Un Deux Trois" })).toBeNull()
    expect(parse(null)).toBeNull()
  })
})

describe("parseAnswer, shortanswer", () => {
  const shortanswer = (typoTolerance?: boolean): Question => ({
    ...question(QUESTION_TYPES.SHORTANSWER, []),
    solutions: [],
    accepted: ["Paris", "Lutèce"],
    ...(typoTolerance !== undefined && { options: { typoTolerance } }),
  })

  it("recognizes an accepted answer and keeps the cleaned input", () => {
    expect(parseAnswer(shortanswer(), { text: "  LUTECE  " }, [])).toEqual({
      answerIds: [1],
      text: "LUTECE",
    })
  })

  it("keeps an input that matches nothing, without answer id", () => {
    expect(parseAnswer(shortanswer(), { text: "Lyon" }, [])).toEqual({
      answerIds: [],
      text: "Lyon",
    })
  })

  it("ignores accents and punctuation, but not a typo by default", () => {
    expect(parseAnswer(shortanswer(), { text: "Lutece!" }, [])).toEqual({
      answerIds: [1],
      text: "Lutece!",
    })
    expect(
      parseAnswer(shortanswer(), { text: "Lutèc" }, [])?.answerIds,
    ).toEqual([])
  })

  it("refuses an empty or too long input", () => {
    expect(parseAnswer(shortanswer(), { text: "   " }, [])).toBeNull()
    expect(parseAnswer(shortanswer(), { text: "a".repeat(61) }, [])).toBeNull()
    expect(
      parseAnswer(shortanswer(), { text: ` ${"a".repeat(60)} ` }, []),
    ).toEqual({ answerIds: [], text: "a".repeat(60) })
  })

  it("refuses indices or a missing text", () => {
    expect(parseAnswer(shortanswer(), { answerKeys: [0] }, [])).toBeNull()
    expect(parseAnswer(shortanswer(), { text: 42 }, [])).toBeNull()
  })

  it("uses the typo tolerance of the question", () => {
    const longer: Question = {
      ...shortanswer(true),
      accepted: ["Versailles"],
    }

    expect(parseAnswer(longer, { text: "Versaille" }, [])?.answerIds).toEqual([
      0,
    ])
    expect(
      parseAnswer(
        { ...longer, options: { typoTolerance: false } },
        { text: "Versaille" },
        [],
      )?.answerIds,
    ).toEqual([])
  })
})

describe("countResponses", () => {
  it("counts the votes per answer of a choice question", () => {
    expect(
      countResponses(question(QUESTION_TYPES.MULTI), [
        { answerIds: [0, 2] },
        { answerIds: [0] },
      ]),
    ).toEqual({ 0: 2, 2: 1 })
  })

  it("counts the players who put each item at its place", () => {
    expect(
      countResponses(
        question(QUESTION_TYPES.ORDERING, ["Un", "Deux", "Trois"]),
        [
          { answerIds: [0, 1, 2] },
          { answerIds: [0, 2, 1] },
          { answerIds: [2, 1, 0] },
        ],
      ),
    ).toEqual({ 0: 2, 1: 2, 2: 1 })
  })

  it("counts the inputs recognized per accepted answer", () => {
    expect(
      countResponses(question(QUESTION_TYPES.SHORTANSWER, []), [
        { answerIds: [1], text: "Lutèce" },
        { answerIds: [], text: "Lyon" },
        { answerIds: [1], text: "lutece" },
      ]),
    ).toEqual({ 1: 2 })
  })
})
