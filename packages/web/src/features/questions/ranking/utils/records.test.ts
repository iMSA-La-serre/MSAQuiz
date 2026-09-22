import type {
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import { rankedItems } from "@razzia/web/features/questions/ranking/utils/records"
import { describe, expect, it } from "vitest"

const question = (playerAnswers: PlayerAnswerRecord[]): QuestionResult => ({
  type: "ranking",
  question: "Classez ces chantiers",
  answers: ["Accueil", "Délais", "Numérique"],
  solutions: [],
  cooldown: 5,
  time: 30,
  playerAnswers,
})

const record = (answerIds: number[] | null): PlayerAnswerRecord => ({
  playerName: "Alice",
  answerIds,
})

describe("rankedItems", () => {
  it("puts the proposals in the order of their rank points", () => {
    expect(
      rankedItems(
        question([record([1, 0, 2]), record([1, 2, 0]), record(null)]),
      ),
    ).toEqual([
      { index: 1, label: "Délais", points: 4, first: 2 },
      { index: 0, label: "Accueil", points: 1, first: 0 },
      { index: 2, label: "Numérique", points: 1, first: 0 },
    ])
  })

  it("keeps the author's order without an answer", () => {
    expect(
      rankedItems(question([record(null)])).map(({ label }) => label),
    ).toEqual(["Accueil", "Délais", "Numérique"])
  })
})
