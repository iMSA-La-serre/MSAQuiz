import { QUESTION_TYPES } from "@razzia/common/constants"
import type { QuestionResult } from "@razzia/common/types/game"
import {
  hasAnswered,
  namedWords,
} from "@razzia/web/features/questions/wordcloud/utils/records"
import { describe, expect, it } from "vitest"

const question = (words: QuestionResult["words"]): QuestionResult => ({
  type: QUESTION_TYPES.WORDCLOUD,
  question: "Un mot pour décrire la MSA ?",
  answers: [],
  solutions: [],
  cooldown: 5,
  time: 40,
  playerAnswers: [],
  words,
})

describe("hasAnswered", () => {
  it("reads the participation a record keeps", () => {
    expect(
      hasAnswered({ playerName: "Alex", answerIds: [], answered: true }),
    ).toBe(true)
    expect(
      hasAnswered({ playerName: "Bea", answerIds: null, answered: false }),
    ).toBe(false)
    expect(hasAnswered({ playerName: "Cyd", answerIds: [] })).toBe(false)
  })
})

describe("namedWords", () => {
  it("names the first words and sums the others", () => {
    expect(
      namedWords(
        question([
          { text: "Solidarité", count: 4 },
          { text: "Proximité", count: 2 },
          { text: "Écoute", count: 1 },
          { text: "Terrain", count: 1 },
        ]),
        2,
      ),
    ).toEqual({
      named: [
        { text: "Solidarité", count: 4 },
        { text: "Proximité", count: 2 },
      ],
      others: { words: 2, count: 2 },
    })
  })

  it("has no words to name when none were kept", () => {
    expect(namedWords(question(undefined), 5)).toEqual({
      named: [],
      others: { words: 0, count: 0 },
    })
  })
})
