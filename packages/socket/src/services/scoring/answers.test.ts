import { QUESTION_TYPES } from "@razzia/common/constants"
import type { Question, QuestionType } from "@razzia/common/types/game"
import { parseAnswerIds } from "@razzia/socket/services/scoring/answers"
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
