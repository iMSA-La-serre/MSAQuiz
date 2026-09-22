import { QUESTION_TYPES, SCORING_MODES } from "@razzia/common/constants"
import type {
  GameResult,
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import {
  buildResultWorkbook,
  exportFilename,
} from "@razzia/socket/services/results-export"
import ExcelJS from "exceljs"
import { describe, expect, it } from "vitest"

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

const result = (questions: QuestionResult[]): GameResult => ({
  id: "result",
  quizzId: "quizz",
  subject: "Quiz d'été !",
  date: "2026-09-01T10:00:00.000Z",
  players: [
    { username: "Alex", points: 1800, rank: 1 },
    { username: "Bea", points: 900, rank: 2 },
    { username: "Cyd", points: 0, rank: 3 },
  ],
  questions,
})

// Every cell of both sheets, row by row, as plain values.
const readWorkbook = async (data: GameResult) => {
  const workbook = new ExcelJS.Workbook()

  await workbook.xlsx.load(
    (await buildResultWorkbook(data)) as unknown as ArrayBuffer,
  )

  return workbook.worksheets.map((sheet) => ({
    name: sheet.name,
    rows: Array.from({ length: sheet.rowCount }, (_, index) => {
      const row = sheet.getRow(index + 1)

      return Array.from(
        { length: sheet.columnCount },
        (__, col) => row.getCell(col + 1).value,
      )
    }),
  }))
}

// A game saved before ordering and shortanswer existed: no `score`, no
// `text` in the answer records.
const LEGACY_RESULT = result([
  question({
    playerAnswers: answers(["Alex", [0]], ["Bea", [1]], ["Cyd", null]),
  }),
  question({
    type: QUESTION_TYPES.MULTI,
    question: "Couleurs primaires ?",
    answers: ["Rouge", "Vert", "Bleu", "Jaune"],
    solutions: [0, 2],
    options: { scoringMode: SCORING_MODES.STRICT },
    playerAnswers: answers(["Alex", [0, 2]], ["Bea", [0]], ["Cyd", []]),
  }),
  question({
    type: QUESTION_TYPES.TRUEFALSE,
    question: "La tomate est un fruit.",
    answers: ["Vrai", "Faux"],
    playerAnswers: answers(["Alex", [0]], ["Bea", [0]], ["Cyd", [1]]),
  }),
  question({
    type: QUESTION_TYPES.POLL,
    question: "Quel créneau ?",
    answers: ["Matin", "Soir"],
    solutions: [],
    playerAnswers: answers(["Alex", [1]], ["Bea", null], ["Cyd", [1]]),
  }),
])

describe("buildResultWorkbook", () => {
  it("keeps the report of the existing types as is", async () => {
    expect(await readWorkbook(LEGACY_RESULT)).toMatchInlineSnapshot(`
      [
        {
          "name": "Classement",
          "rows": [
            [
              "Rang",
              "Joueur",
              "Points",
            ],
            [
              1,
              "Alex",
              1800,
            ],
            [
              2,
              "Bea",
              900,
            ],
            [
              3,
              "Cyd",
              0,
            ],
          ],
        },
        {
          "name": "Questions",
          "rows": [
            [
              "Question",
              "Réponse",
              "Correcte",
              "Votes",
            ],
            [
              "Q1 — Capitale de la France ?",
              null,
              null,
              null,
            ],
            [
              null,
              "Paris",
              "✓",
              1,
            ],
            [
              null,
              "Lyon",
              "",
              1,
            ],
            [
              null,
              "Marseille",
              "",
              0,
            ],
            [
              null,
              "Nice",
              "",
              0,
            ],
            [
              null,
              "Sans réponse",
              null,
              1,
            ],
            [
              null,
              null,
              null,
              null,
            ],
            [
              "Q2 — Couleurs primaires ?",
              null,
              null,
              null,
            ],
            [
              null,
              "Rouge",
              "✓",
              2,
            ],
            [
              null,
              "Vert",
              "",
              0,
            ],
            [
              null,
              "Bleu",
              "✓",
              1,
            ],
            [
              null,
              "Jaune",
              "",
              0,
            ],
            [
              null,
              "Sans réponse",
              null,
              1,
            ],
            [
              null,
              null,
              null,
              null,
            ],
            [
              "Q3 — La tomate est un fruit.",
              null,
              null,
              null,
            ],
            [
              null,
              "Vrai",
              "✓",
              2,
            ],
            [
              null,
              "Faux",
              "",
              1,
            ],
            [
              null,
              "Sans réponse",
              null,
              0,
            ],
            [
              null,
              null,
              null,
              null,
            ],
            [
              "Q4 — Quel créneau ?",
              null,
              null,
              null,
            ],
            [
              null,
              "Matin",
              "",
              0,
            ],
            [
              null,
              "Soir",
              "",
              2,
            ],
            [
              null,
              "Sans réponse",
              null,
              1,
            ],
          ],
        },
      ]
    `)
  })
})

describe("exportFilename", () => {
  it("names the file after the subject and the date", () => {
    expect(exportFilename(LEGACY_RESULT)).toBe("Quiz dété - 2026-09-01.xlsx")
  })
})

describe("buildResultWorkbook, newer types", () => {
  it("reports ordering and shortanswer, and skips an unknown type", async () => {
    const [, questions] = await readWorkbook(
      result([
        question({
          type: QUESTION_TYPES.ORDERING,
          question: "Dans l'ordre ?",
          answers: ["Un", "Deux", "Trois"],
          solutions: [],
          playerAnswers: [
            { playerName: "Alex", answerIds: [0, 1, 2], score: 1 },
            { playerName: "Bea", answerIds: [0, 2, 1], score: 1 / 3 },
            { playerName: "Cyd", answerIds: null, score: 0 },
          ],
        }),
        question({
          type: "buzzer" as QuestionResult["type"],
          question: "Buzzer ?",
          playerAnswers: answers(["Alex", [0]]),
        }),
        question({
          type: QUESTION_TYPES.SHORTANSWER,
          question: "Ancien nom de Paris ?",
          answers: [],
          solutions: [],
          accepted: ["Lutèce", "Lutetia"],
          playerAnswers: [
            { playerName: "Alex", answerIds: [0], text: "lutece", score: 1 },
            { playerName: "Bea", answerIds: [], text: "Paname", score: 0 },
            { playerName: "Cyd", answerIds: null, text: null, score: 0 },
          ],
        }),
      ]),
    )

    expect(questions.rows).toMatchInlineSnapshot(`
      [
        [
          "Question",
          "Réponse",
          "Correcte",
          "Votes",
        ],
        [
          "Q1 — Dans l'ordre ?",
          null,
          null,
          null,
        ],
        [
          null,
          "Éléments dans l'ordre correct",
          null,
          "Bien placés",
        ],
        [
          null,
          "1. Un",
          null,
          2,
        ],
        [
          null,
          "2. Deux",
          null,
          1,
        ],
        [
          null,
          "3. Trois",
          null,
          1,
        ],
        [
          null,
          "Ordres exacts",
          null,
          1,
        ],
        [
          null,
          "Score moyen",
          null,
          0.6666666666666666,
        ],
        [
          null,
          "Sans réponse",
          null,
          1,
        ],
        [
          null,
          null,
          null,
          null,
        ],
        [
          "Q3 — Ancien nom de Paris ?",
          null,
          null,
          null,
        ],
        [
          null,
          "Lutèce",
          "✓",
          1,
        ],
        [
          null,
          "Lutetia",
          "✓",
          0,
        ],
        [
          null,
          "Non reconnues",
          null,
          1,
        ],
        [
          null,
          "Sans réponse",
          null,
          1,
        ],
      ]
    `)
  })
})
