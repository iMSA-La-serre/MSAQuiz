import { QUESTION_TYPES, SCORING_MODES } from "@razzia/common/constants"
import type {
  GameResult,
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import {
  aggregateQuestions,
  overallSuccessRate,
} from "@razzia/socket/services/stats"
import { describe, expect, it } from "vitest"

// Frozen statistics of games saved before ordering and shortanswer existed
// (no `score`, no `text`): they must read exactly as they always did.

const answers = (
  ...records: Array<[string, number[] | null]>
): PlayerAnswerRecord[] =>
  records.map(([playerName, answerIds]) => ({ playerName, answerIds }))

const question = (over: Partial<QuestionResult> = {}): QuestionResult => ({
  type: QUESTION_TYPES.SINGLE,
  question: "Capitale de la France ?",
  answers: ["Paris", "Lyon", "Marseille", "Nice"],
  solutions: [0],
  cooldown: 5,
  time: 20,
  playerAnswers: [],
  ...over,
})

const game = (
  questions: QuestionResult[],
  date = "2026-09-01",
): GameResult => ({
  id: `game-${date}`,
  subject: "Quiz",
  date,
  players: [],
  questions,
})

const LEGACY_GAMES = [
  game(
    [
      question({
        playerAnswers: answers(["Alex", [0]], ["Bea", [2]], ["Cyd", null]),
      }),
      question({
        type: QUESTION_TYPES.MULTI,
        question: "Couleurs primaires ?",
        answers: ["Rouge", "Vert", "Bleu", "Jaune"],
        solutions: [0, 2],
        options: { scoringMode: SCORING_MODES.BALANCED },
        playerAnswers: answers(
          ["Alex", [0, 2]],
          ["Bea", [0]],
          ["Cyd", [1, 3]],
          ["Dan", []],
        ),
      }),
      question({
        type: QUESTION_TYPES.TRUEFALSE,
        question: "La tomate est un fruit.",
        answers: ["Vrai", "Faux"],
        playerAnswers: answers(["Alex", [0]], ["Bea", [1]]),
      }),
      question({
        type: QUESTION_TYPES.POLL,
        question: "Quel créneau ?",
        answers: ["Matin", "Soir"],
        solutions: [],
        playerAnswers: answers(["Alex", [1]], ["Bea", [1]], ["Cyd", [0]]),
      }),
    ],
    "2026-09-02",
  ),
  game(
    [
      // Edited between the two games: one more answer, and a solution that
      // points outside the answers.
      question({
        answers: ["Paris", "Lyon", "Bordeaux"],
        solutions: [0, 5],
        playerAnswers: answers(["Eve", [2]], ["Fox", [0]], ["Gus", [7]]),
      }),
      question({
        type: QUESTION_TYPES.MULTI,
        question: "Couleurs primaires ?",
        answers: ["Rouge", "Vert", "Bleu", "Jaune"],
        solutions: [0, 2],
        options: { scoringMode: SCORING_MODES.STRICT },
        playerAnswers: answers(["Eve", [0]], ["Fox", [0, 2]]),
      }),
    ],
    "2026-09-01",
  ),
]

describe("statistics of games saved before score and text", () => {
  it("keep the same output", () => {
    const stats = aggregateQuestions(LEGACY_GAMES)

    expect(stats).toMatchInlineSnapshot(`
      [
        {
          "answerCount": 5,
          "answers": [
            {
              "count": 2,
              "label": "Paris",
            },
            {
              "count": 1,
              "label": "Marseille",
            },
            {
              "count": 1,
              "label": "Bordeaux",
            },
          ],
          "correctCount": 2,
          "gameCount": 2,
          "missingCount": 1,
          "question": "Capitale de la France ?",
          "scored": true,
          "solutionLabels": [
            "Paris",
          ],
          "successRate": 0.4,
          "type": "single",
        },
        {
          "answerCount": 2,
          "answers": [
            {
              "count": 1,
              "label": "Vrai",
            },
            {
              "count": 1,
              "label": "Faux",
            },
          ],
          "correctCount": 1,
          "gameCount": 1,
          "missingCount": 0,
          "question": "La tomate est un fruit.",
          "scored": true,
          "solutionLabels": [
            "Vrai",
          ],
          "successRate": 0.5,
          "type": "truefalse",
        },
        {
          "answerCount": 5,
          "answers": [
            {
              "count": 4,
              "label": "Rouge",
            },
            {
              "count": 2,
              "label": "Bleu",
            },
            {
              "count": 1,
              "label": "Vert",
            },
            {
              "count": 1,
              "label": "Jaune",
            },
          ],
          "correctCount": 3,
          "gameCount": 2,
          "missingCount": 1,
          "question": "Couleurs primaires ?",
          "scored": true,
          "solutionLabels": [
            "Rouge",
            "Bleu",
          ],
          "successRate": 0.6,
          "type": "multi",
        },
        {
          "answerCount": 3,
          "answers": [
            {
              "count": 2,
              "label": "Soir",
            },
            {
              "count": 1,
              "label": "Matin",
            },
          ],
          "correctCount": 0,
          "gameCount": 1,
          "missingCount": 0,
          "question": "Quel créneau ?",
          "scored": false,
          "solutionLabels": [],
          "successRate": null,
          "type": "poll",
        },
      ]
    `)
    expect(overallSuccessRate(stats)).toMatchInlineSnapshot(`0.5`)
  })
})
