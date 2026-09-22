import { ORDER_SCORING, QUESTION_TYPES } from "@razzia/common/constants"
import type { Question } from "@razzia/common/types/game"
import { scoreOrdering } from "@razzia/common/utils/ordering"
import {
  drawPublicOrder,
  toPublicAnswers,
} from "@razzia/socket/services/game/public-answers"
import { describe, expect, it } from "vitest"

const DRAWS = 2000

const question = (over: Partial<Question>): Question => ({
  type: QUESTION_TYPES.SINGLE,
  question: "Question ?",
  answers: ["A", "B", "C", "D"],
  solutions: [0],
  cooldown: 5,
  time: 20,
  ...over,
})

describe("drawPublicOrder", () => {
  it.each([3, 4, 5, 6])(
    "draws a permutation of %i items with at most one in place",
    (length) => {
      const seen = new Set<string>()

      for (let draw = 0; draw < DRAWS; draw += 1) {
        const order = drawPublicOrder(length)
        const inPlace = order.filter((item, index) => item === index).length

        expect([...order].sort((a, b) => a - b)).toEqual(
          Array.from({ length }, (_, index) => index),
        )
        expect(inPlace).toBeLessThanOrEqual(1)
        // Submitting the list as shown is worth one item at most.
        expect(
          scoreOrdering(order, length, ORDER_SCORING.POSITION),
        ).toBeLessThanOrEqual(1 / length)

        seen.add(order.join())
      }

      // Every allowed order comes up: 5 of the 6 orders of 3 items.
      if (length === 3) {
        expect(seen.size).toBe(5)
      }
    },
  )
})

describe("toPublicAnswers", () => {
  it("keeps the list of a choice question as is", () => {
    expect(toPublicAnswers(question({}))).toEqual({
      answers: ["A", "B", "C", "D"],
      order: [0, 1, 2, 3],
    })
  })

  it("shuffles an ordering and says where each item comes from", () => {
    const items = ["Un", "Deux", "Trois", "Quatre", "Cinq"]
    const { answers, order } = toPublicAnswers(
      question({
        type: QUESTION_TYPES.ORDERING,
        answers: items,
        solutions: [],
      }),
    )

    expect(answers).not.toEqual(items)
    expect(answers).toEqual(order.map((index) => items[index]))
  })

  it("shows no answers for a shortanswer", () => {
    expect(
      toPublicAnswers(
        question({
          type: QUESTION_TYPES.SHORTANSWER,
          answers: [],
          solutions: [],
          accepted: ["Paris"],
        }),
      ),
    ).toEqual({ answers: [], order: [] })
  })
})
