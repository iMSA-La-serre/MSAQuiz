import { STATUS } from "@razzia/common/types/game/status"
import {
  answerToResend,
  statusKey,
} from "@razzia/web/features/game/utils/answer-delivery"
import { describe, expect, it } from "vitest"

const answering = (questionNumber: number) => ({
  name: STATUS.SELECT_ANSWER,
  data: { question: "Combien ?", questionNumber, answers: ["8", "12"] },
})

const pending = { questionNumber: 3, answer: { answerKeys: [1] } }

describe("answerToResend", () => {
  it("sends the answer again while its question still takes answers", () => {
    expect(answerToResend(pending, answering(3))).toEqual({ answerKeys: [1] })
  })

  it("sends nothing once confirmed, over, or for another question", () => {
    expect(answerToResend(null, answering(3))).toBeNull()
    expect(
      answerToResend(pending, {
        name: STATUS.WAIT,
        data: { text: "game:waitingForAnswers" },
      }),
    ).toBeNull()
    expect(
      answerToResend(pending, { name: STATUS.SHOW_RESULT, data: {} }),
    ).toBeNull()
    expect(answerToResend(pending, answering(4))).toBeNull()
  })
})

describe("statusKey", () => {
  it("tells a question's answers from the next one's", () => {
    expect(statusKey(answering(3))).not.toBe(statusKey(answering(4)))
    expect(statusKey(answering(3))).toBe(statusKey(answering(3)))
  })

  it("keys the other screens by their status alone, as before", () => {
    expect(statusKey({ name: STATUS.SHOW_RESULT, data: {} })).toBe(
      STATUS.SHOW_RESULT,
    )
  })
})
