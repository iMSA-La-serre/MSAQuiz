import type {
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import {
  hasAnswered,
  scaleCountsOf,
} from "@razzia/web/features/questions/scale/utils/records"
import { describe, expect, it } from "vitest"

const question = (over: Partial<QuestionResult> = {}): QuestionResult => ({
  type: "scale",
  question: "Cette journée répond-elle à vos attentes ?",
  answers: [],
  solutions: [],
  cooldown: 5,
  time: 20,
  options: { scaleMin: 1, scaleMax: 5 },
  playerAnswers: [],
  ...over,
})

const record = (answered: boolean): PlayerAnswerRecord =>
  answered
    ? { playerName: "Alice", answerIds: [], answered: true }
    : { playerName: "Alice", answerIds: null, answered: false }

describe("hasAnswered", () => {
  it("only reads whether the player answered", () => {
    expect(hasAnswered(record(true))).toBe(true)
    expect(hasAnswered(record(false))).toBe(false)
  })
})

describe("scaleCountsOf", () => {
  it("reads the counts of the question with their mean and median", () => {
    expect(
      scaleCountsOf(
        question({ scale: { counts: [0, 0, 1, 2, 1], skipped: 2 } }),
      ),
    ).toEqual({ counts: [0, 0, 1, 2, 1], skipped: 2, mean: 4, median: 4 })
  })

  it("gives a count per level when the question kept none", () => {
    expect(scaleCountsOf(question({ scaleWithheld: true }))).toEqual({
      counts: [0, 0, 0, 0, 0],
      skipped: 0,
      mean: null,
      median: null,
    })
  })
})
