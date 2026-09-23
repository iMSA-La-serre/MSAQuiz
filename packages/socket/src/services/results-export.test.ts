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

describe("buildResultWorkbook, wordcloud", () => {
  const WORDCLOUD = question({
    type: QUESTION_TYPES.WORDCLOUD,
    question: "Un mot pour la MSA ?",
    answers: [],
    solutions: [],
    playerAnswers: [
      { playerName: "Alex", answerIds: [], answered: true, score: 0 },
      { playerName: "Bea", answerIds: [], answered: true, score: 0 },
      { playerName: "Cyd", answerIds: null, answered: false, score: 0 },
    ],
    words: [
      { text: "Écoute", count: 2 },
      { text: "Terrain", count: 1 },
    ],
  })

  it("reports the words and who answered, never who typed what", async () => {
    const sheets = await readWorkbook(
      result([
        question({ playerAnswers: answers(["Alex", [0]], ["Bea", [1]]) }),
        WORDCLOUD,
      ]),
    )

    expect(sheets.map(({ name }) => name)).toEqual([
      "Classement",
      "Questions",
      "Participation",
    ])
    // The blank row closing the question is not counted as the last one.
    expect(sheets[1]?.rows.slice(-6)).toEqual([
      ["Q2 — Un mot pour la MSA ?", null, null, null],
      [null, "Mots proposés", null, "Nombre"],
      [null, "Écoute", null, 2],
      [null, "Terrain", null, 1],
      [null, "Ont répondu", null, 2],
      [null, "Sans réponse", null, 1],
    ])
    expect(sheets[2]?.rows).toEqual([
      ["Joueur", "Q2"],
      ["Alex", "Oui"],
      ["Bea", "Oui"],
      ["Cyd", "Non"],
    ])
  })

  it("says when no word was kept", async () => {
    const [, questions] = await readWorkbook(
      result([{ ...WORDCLOUD, words: [] }]),
    )

    expect(questions.rows.slice(2, 4)).toEqual([
      [null, "Mots proposés", null, "Nombre"],
      [null, "Aucun mot", null, null],
    ])
  })

  it("lists no word typed by too few players, only who answered", async () => {
    const { words: _words, ...withoutWords } = WORDCLOUD
    const [, questions, participation] = await readWorkbook(
      result([
        {
          ...withoutWords,
          playerAnswers: [
            { playerName: "Alex", answerIds: [], answered: true, score: 0 },
            { playerName: "Bea", answerIds: null, answered: false, score: 0 },
            { playerName: "Cyd", answerIds: null, answered: false, score: 0 },
          ],
          wordsWithheld: true,
        },
      ]),
    )

    expect(questions.rows.slice(1)).toEqual([
      ["Q1 — Un mot pour la MSA ?", null, null, null],
      [null, "Mots proposés", null, "Nombre"],
      [null, "Trop peu de réponses pour afficher les mots", null, null],
      [null, "Ont répondu", null, 1],
      [null, "Sans réponse", null, 2],
    ])
    expect(participation.rows).toEqual([
      ["Joueur", "Q1"],
      ["Alex", "Oui"],
      ["Bea", "Non"],
      ["Cyd", "Non"],
    ])
  })

  it("takes each record once when two players share a username", async () => {
    const [, , participation] = await readWorkbook({
      ...result([
        {
          ...WORDCLOUD,
          playerAnswers: [
            { playerName: "Marie", answerIds: [], answered: true, score: 0 },
            { playerName: "Marie", answerIds: null, answered: false, score: 0 },
            { playerName: "Paul", answerIds: null, answered: false, score: 0 },
          ],
        },
      ]),
      players: [
        { username: "Marie", points: 0, rank: 1 },
        { username: "Marie", points: 0, rank: 2 },
        { username: "Paul", points: 0, rank: 3 },
      ],
    })

    expect(participation.rows).toEqual([
      ["Joueur", "Q1"],
      ["Marie", "Oui"],
      ["Marie", "Non"],
      ["Paul", "Non"],
    ])
  })
})

describe("buildResultWorkbook, estimate", () => {
  // Numbers are written the French way: spaces that do not break.
  const SPACES = new RegExp(
    `[${String.fromCodePoint(0xa0)}${String.fromCodePoint(0x202f)}]`,
    "gu",
  )
  const ESTIMATE = question({
    type: QUESTION_TYPES.ESTIMATE,
    question: "Combien de caisses compte la MSA ?",
    answers: [],
    solutions: [],
    expected: 35,
    options: { tolerance: 2, unit: "caisses" },
    playerAnswers: [
      { playerName: "Alex", answerIds: [], value: 35, score: 1 },
      { playerName: "Bea", answerIds: [], value: 30, score: 0 },
      { playerName: "Cyd", answerIds: null, value: null, score: 0 },
    ],
  })

  const plain = (cell: unknown) =>
    typeof cell === "string" ? cell.replace(SPACES, " ") : cell

  it("reports the right value, the values by range and their median", async () => {
    const [, questions] = await readWorkbook(result([ESTIMATE]))

    expect(questions.rows.slice(1).map((row) => row.map(plain))).toEqual([
      ["Q1 — Combien de caisses compte la MSA ?", null, null, null],
      [null, "Bonne réponse : 35 caisses, à 2 caisses près", null, null],
      [null, "Moins de 28 caisses", null, 0],
      [null, "28 à 32 caisses", null, 1],
      [null, "33 à 37 caisses", "✓", 1],
      [null, "38 à 42 caisses", null, 0],
      [null, "Plus de 42 caisses", null, 0],
      [null, "Médiane (caisses)", null, 32.5],
      [null, "Sans réponse", null, 1],
    ])
  })
})

describe("buildResultWorkbook, highlight", () => {
  const HIGHLIGHT = question({
    type: QUESTION_TYPES.HIGHLIGHT,
    question: "Repérez les deux délais",
    text: "Prévenez [sous 48 heures], envoyez [sous 3 jours], [par courrier].",
    answers: ["sous 48 heures", "sous 3 jours", "par courrier"],
    solutions: [0, 1],
    options: { scoringMode: SCORING_MODES.BALANCED },
    playerAnswers: [
      { playerName: "Alex", answerIds: [0, 1], score: 1 },
      { playerName: "Bea", answerIds: [0, 2], score: 0 },
      { playerName: "Cyd", answerIds: null, score: 0 },
    ],
  })

  it("reports the text, the passages tapped and the mean score", async () => {
    const [, questions] = await readWorkbook(result([HIGHLIGHT]))

    expect(questions.rows.slice(1)).toEqual([
      ["Q1 — Repérez les deux délais", null, null, null],
      [null, `Texte : ${HIGHLIGHT.text}`, null, null],
      [null, "sous 48 heures", "✓", 2],
      [null, "sous 3 jours", "✓", 1],
      [null, "par courrier", "", 1],
      [null, "Réponses sans faute", null, 1],
      [null, "Score moyen", null, 0.5],
      [null, "Sans réponse", null, 1],
    ])
  })
})

describe("buildResultWorkbook, statements and categorize", () => {
  it("reports each statement with its right target and the mean score", async () => {
    const [, questions] = await readWorkbook(
      result([
        question({
          type: QUESTION_TYPES.STATEMENTS,
          question: "Vrai ou faux ?",
          answers: ["La MSA couvre les salariés", "La MSA verse le chômage"],
          solutions: [],
          targets: ["Vrai", "Faux"],
          expectedTargets: [0, 1],
          playerAnswers: [
            { playerName: "Alex", answerIds: [0, 1], score: 1 },
            { playerName: "Bea", answerIds: [0, 0], score: 0.5 },
            { playerName: "Cyd", answerIds: null, score: 0 },
          ],
        }),
      ]),
    )

    expect(questions.rows.slice(1)).toEqual([
      ["Q1 — Vrai ou faux ?", null, null, null],
      [null, "Affirmations", "Réponse", "Justes"],
      [null, "La MSA couvre les salariés", "Vrai", 2],
      [null, "La MSA verse le chômage", "Faux", 1],
      [null, "Réponses sans faute", null, 1],
      [null, "Score moyen", null, 0.75],
      [null, "Sans réponse", null, 1],
    ])
  })

  it("lists the categories of a categorize question first", async () => {
    const [, questions] = await readWorkbook(
      result([
        question({
          type: QUESTION_TYPES.CATEGORIZE,
          question: "Quelle branche ?",
          answers: ["Allocations familiales", "Pension"],
          solutions: [],
          targets: ["Famille", "Retraite"],
          expectedTargets: [0, 1],
          playerAnswers: [
            { playerName: "Alex", answerIds: [1, 1] },
            { playerName: "Bea", answerIds: [0, 1] },
          ],
        }),
      ]),
    )

    expect(questions.rows.slice(1)).toEqual([
      ["Q1 — Quelle branche ?", null, null, null],
      [null, "Catégories : Famille, Retraite", null, null],
      [null, "Éléments", "Réponse", "Justes"],
      [null, "Allocations familiales", "Famille", 1],
      [null, "Pension", "Retraite", 2],
      [null, "Réponses sans faute", null, 1],
      [null, "Score moyen", null, 0.75],
      [null, "Sans réponse", null, 1],
    ])
  })

  it("leaves an item without a right target blank, never the last one", async () => {
    const [, questions] = await readWorkbook(
      result([
        question({
          type: QUESTION_TYPES.CATEGORIZE,
          question: "Quelle branche ?",
          answers: ["Allocations familiales", "Pension"],
          solutions: [],
          targets: ["Famille", "Retraite"],
          // Saved before the targets were recorded, or short of one.
          expectedTargets: [0],
          playerAnswers: [{ playerName: "Alex", answerIds: [0, 1] }],
        }),
      ]),
    )

    expect(questions.rows.slice(4, 6)).toEqual([
      [null, "Allocations familiales", "Famille", 1],
      [null, "Pension", "", 0],
    ])
  })
})

describe("buildResultWorkbook, ranking", () => {
  const RANKING = question({
    type: QUESTION_TYPES.RANKING,
    question: "Classez ces chantiers",
    answers: ["Accueil", "Délais", "Numérique"],
    solutions: [],
    playerAnswers: answers(
      ["Alex", [1, 0, 2]],
      ["Bea", [1, 2, 0]],
      ["Cyd", null],
    ),
  })

  it("reports the proposals by priority, with their points and first choices", async () => {
    const [, questions] = await readWorkbook(result([RANKING]))

    expect(questions.rows.slice(2, 7)).toEqual([
      [null, "Propositions par priorité", "Points", "1ers choix"],
      [null, "1. Délais", 4, 2],
      [null, "2. Accueil", 1, 0],
      [null, "3. Numérique", 1, 0],
      [null, "Sans réponse", null, 1],
    ])
  })
})

describe("buildResultWorkbook, scale", () => {
  const SCALE = question({
    type: QUESTION_TYPES.SCALE,
    question: "Cette journée répond-elle à vos attentes ?",
    answers: [],
    solutions: [],
    options: {
      scaleMin: 1,
      scaleMax: 3,
      scaleLow: "Pas du tout",
      scaleHigh: "Tout à fait",
      scaleSkip: true,
    },
    playerAnswers: [
      { playerName: "Alex", answerIds: [], answered: true, score: 0 },
      { playerName: "Bea", answerIds: [], answered: true, score: 0 },
      { playerName: "Cyd", answerIds: [], answered: true, score: 0 },
    ],
    scale: { counts: [0, 1, 1], skipped: 1 },
  })

  it("reports the levels and who answered, never who picked what", async () => {
    const sheets = await readWorkbook(result([SCALE]))

    expect(sheets[1]?.rows.slice(2, 10)).toEqual([
      [null, "Niveaux", null, "Réponses"],
      [null, "1 — Pas du tout", null, 0],
      [null, "2", null, 1],
      [null, "3 — Tout à fait", null, 1],
      [null, "Sans avis", null, 1],
      [null, "Moyenne", null, 2.5],
      [null, "Médiane", null, 2.5],
      [null, "Ont répondu", null, 3],
    ])
    expect(sheets[2]?.rows).toEqual([
      ["Joueur", "Q1"],
      ["Alex", "Oui"],
      ["Bea", "Oui"],
      ["Cyd", "Oui"],
    ])
  })

  it("says when the counts were not kept, and prints none of them", async () => {
    const [, questions] = await readWorkbook(
      result([{ ...SCALE, scale: undefined, scaleWithheld: true }]),
    )

    // No level and no « Sans avis » at zero under the warning: they would
    // read as nobody having picked a level or preferred not to answer.
    expect(questions.rows.slice(2)).toEqual([
      [null, "Niveaux", null, "Réponses"],
      [null, "Trop peu de réponses pour afficher la répartition", null, null],
      [null, "Ont répondu", null, 3],
      [null, "Sans réponse", null, 0],
    ])
  })
})

describe("buildResultWorkbook, markers", () => {
  const MARKERS = question({
    type: QUESTION_TYPES.MARKERS,
    question: "Où se trouve le point de rassemblement ?",
    media: { type: "image", url: "https://msa.example/plan.png" },
    answers: ["Le hangar", "La cour", "Le portail"],
    markers: [
      { x: 20, y: 30 },
      { x: 55, y: 60 },
      { x: 80, y: 15 },
    ],
    solutions: [1],
    playerAnswers: answers(["Alex", [1]], ["Bea", [2]], ["Cyd", null]),
  })

  it("reports the markers numbered as on the image, the right ones ticked", async () => {
    const [, questions] = await readWorkbook(result([MARKERS]))

    expect(questions.rows.slice(2, 7)).toEqual([
      [null, "Repères", "Correcte", "Choix"],
      [null, "1. Le hangar", "", 0],
      [null, "2. La cour", "✓", 1],
      [null, "3. Le portail", "", 1],
      [null, "Sans réponse", null, 1],
    ])
  })
})

describe("buildResultWorkbook, poll with several answers", () => {
  it("counts every answer ticked, then the players who answered", async () => {
    const [, questions] = await readWorkbook(
      result([
        question({
          type: QUESTION_TYPES.POLL,
          question: "Quels formats vous conviennent ?",
          answers: ["Présentiel", "Distanciel", "Hybride"],
          solutions: [],
          options: { scoringMode: SCORING_MODES.BALANCED, multiple: true },
          playerAnswers: answers(["Alex", [0, 2]], ["Bea", [2]], ["Cyd", null]),
        }),
      ]),
    )

    expect(questions.rows.slice(2, 7)).toEqual([
      [null, "Présentiel", "", 1],
      [null, "Distanciel", "", 0],
      [null, "Hybride", "", 2],
      [null, "Ont répondu", null, 2],
      [null, "Sans réponse", null, 1],
    ])
  })
})

describe("buildResultWorkbook, single choice with partial credits", () => {
  it("gives the credit of the partly right answers and the mean score", async () => {
    const [, questions] = await readWorkbook(
      result([
        question({
          question: "Combien de caisses régionales compte la MSA ?",
          answers: ["12", "35", "50", "101"],
          solutions: [1],
          options: {
            scoringMode: SCORING_MODES.BALANCED,
            credits: [50, 100, 0, 0],
          },
          playerAnswers: [
            { playerName: "Alex", answerIds: [1], score: 1 },
            { playerName: "Bea", answerIds: [0], score: 0.5 },
            { playerName: "Cyd", answerIds: [3], score: 0 },
          ],
        }),
      ]),
    )

    expect(questions.rows.slice(2, 8)).toEqual([
      [null, "12", "50\u00a0%", 1],
      [null, "35", "✓", 1],
      [null, "50", "", 0],
      [null, "101", "", 1],
      [null, "Score moyen", null, 0.5],
      [null, "Sans réponse", null, 0],
    ])
  })

  it("reports a single choice whose credits are all 0 as any other", async () => {
    const [, questions] = await readWorkbook(
      result([
        question({
          options: {
            scoringMode: SCORING_MODES.BALANCED,
            credits: [100, 0, 0, 0],
          },
          playerAnswers: answers(["Alex", [0]], ["Bea", [1]], ["Cyd", null]),
        }),
      ]),
    )

    expect(questions.rows.slice(2, 7)).toEqual([
      [null, "Paris", "✓", 1],
      [null, "Lyon", "", 1],
      [null, "Marseille", "", 0],
      [null, "Nice", "", 0],
      [null, "Sans réponse", null, 1],
    ])
  })
})
