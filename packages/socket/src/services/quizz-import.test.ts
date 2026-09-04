import { QUESTION_TYPES, SCORING_MODES } from "@razzia/common/constants"
import { quizzValidator } from "@razzia/common/validators/quizz"
import { parseQuizzXlsx } from "@razzia/socket/services/quizz-import"
import ExcelJS from "exceljs"
import { describe, expect, it } from "vitest"

type Cell = string | number | null

const HEADERS: Cell[] = [
  "Question",
  "Answer 1",
  "Answer 2",
  "Answer 3",
  "Answer 4",
  "Time limit",
  "Correct answer(s)",
]

/** Builds a one-sheet workbook, `rows` starting at `firstRow` and column A. */
const buildXlsx = async (rows: Cell[][], firstRow = 1): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Quiz")

  rows.forEach((cells, rowIndex) => {
    cells.forEach((value, colIndex) => {
      if (value !== null) {
        sheet.getRow(firstRow + rowIndex).getCell(colIndex + 1).value = value
      }
    })
  })

  return Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer)
}

/** Imports a workbook and checks the result is a quiz the app would accept. */
const importXlsx = async (rows: Cell[][], firstRow = 1, colOffset = 0) => {
  const padded = rows.map((cells) => [
    ...Array<Cell>(colOffset).fill(null),
    ...cells,
  ])

  return quizzValidator.parse(
    await parseQuizzXlsx(await buildXlsx(padded, firstRow), "Import Kahoot"),
  )
}

describe("header detection", () => {
  it("reads a sheet with English headers", async () => {
    const quizz = await importXlsx([
      HEADERS,
      [
        "Capitale de la France ?",
        "Paris",
        "Lyon",
        "Marseille",
        "Nice",
        30,
        "1",
      ],
    ])

    expect(quizz.subject).toBe("Import Kahoot")
    expect(quizz.questions).toHaveLength(1)
    expect(quizz.questions[0]).toMatchObject({
      type: QUESTION_TYPES.SINGLE,
      question: "Capitale de la France ?",
      answers: ["Paris", "Lyon", "Marseille", "Nice"],
      solutions: [0],
      cooldown: 5,
      time: 30,
    })
  })

  it("reads a sheet with French headers", async () => {
    const quizz = await importXlsx([
      ["Question", "Réponse 1", "Réponse 2", "Temps", "Correct"],
      ["Deux plus deux ?", "3", "4", 25, "2"],
    ])

    expect(quizz.questions[0]).toMatchObject({
      answers: ["3", "4"],
      solutions: [1],
      time: 25,
    })
  })

  it("falls back to the Kahoot template layout, data from row 9", async () => {
    const quizz = await importXlsx(
      [["Capitale de l'Italie ?", "Rome", "Milan", "Turin", "Naples", 20, "1"]],
      9,
      1,
    )

    expect(quizz.questions[0]).toMatchObject({
      question: "Capitale de l'Italie ?",
      answers: ["Rome", "Milan", "Turin", "Naples"],
      solutions: [0],
    })
  })
})

describe("answers mapping", () => {
  it("turns several correct answers into a strict multi question", async () => {
    const quizz = await importXlsx([
      HEADERS,
      ["Couleurs primaires ?", "Rouge", "Vert", "Bleu", "Jaune", 20, "1,3"],
    ])

    expect(quizz.questions[0]).toMatchObject({
      type: QUESTION_TYPES.MULTI,
      solutions: [0, 2],
      options: { scoringMode: SCORING_MODES.STRICT },
    })
  })

  it("accepts a semicolon as separator and ignores duplicates", async () => {
    const quizz = await importXlsx([
      HEADERS,
      ["Couleurs primaires ?", "Rouge", "Vert", "Bleu", "Jaune", 20, "1;3;1"],
    ])

    expect(quizz.questions[0].solutions).toEqual([0, 2])
  })

  it("does not shift the correct answer when a cell is left blank", async () => {
    const quizz = await importXlsx([
      HEADERS,
      ["Capitale de l'Espagne ?", "Paris", null, "Madrid", "Rome", 20, "3"],
    ])

    expect(quizz.questions[0]).toMatchObject({
      answers: ["Paris", "Madrid", "Rome"],
      solutions: [1],
    })
  })

  it("ignores correct indices pointing outside the answer columns", async () => {
    const quizz = await importXlsx([
      HEADERS,
      ["Capitale du Portugal ?", "Lisbonne", "Porto", null, null, 20, "1,7"],
    ])

    expect(quizz.questions[0].solutions).toEqual([0])
  })
})

describe("time limits", () => {
  const question = (time: Cell) => [
    "Capitale de la Belgique ?",
    "Bruxelles",
    "Anvers",
    null,
    null,
    time,
    "1",
  ]

  it("clamps a long time to 120 seconds", async () => {
    const quizz = await importXlsx([HEADERS, question(300)])

    expect(quizz.questions[0].time).toBe(120)
  })

  it("raises a short time to 5 seconds", async () => {
    const quizz = await importXlsx([HEADERS, question(2)])

    expect(quizz.questions[0].time).toBe(5)
  })

  it("defaults to 20 seconds when the cell is empty or invalid", async () => {
    const empty = await importXlsx([HEADERS, question(null)])
    const invalid = await importXlsx([HEADERS, question("illimité")])

    expect(empty.questions[0].time).toBe(20)
    expect(invalid.questions[0].time).toBe(20)
  })
})

describe("skipped rows", () => {
  const valid: Cell[] = [
    "Capitale de la Grèce ?",
    "Athènes",
    "Sparte",
    null,
    null,
    20,
    "1",
  ]

  it("skips a row without question text", async () => {
    const quizz = await importXlsx([
      HEADERS,
      [null, "Athènes", "Sparte", null, null, 20, "1"],
      valid,
    ])

    expect(quizz.questions).toHaveLength(1)
  })

  it("skips a row with fewer than two answers", async () => {
    const quizz = await importXlsx([
      HEADERS,
      ["Une seule réponse ?", "Oui", null, null, null, 20, "1"],
      valid,
    ])

    expect(quizz.questions).toHaveLength(1)
  })

  it("skips a row without a usable correct answer", async () => {
    const quizz = await importXlsx([
      HEADERS,
      ["Sans solution ?", "Oui", "Non", null, null, 20, ""],
      valid,
    ])

    expect(quizz.questions).toHaveLength(1)
  })
})

describe("rejected files", () => {
  const reject = async (rows: Cell[][]) =>
    expect(parseQuizzXlsx(await buildXlsx(rows), "Import")).rejects.toThrow(
      "errors:quizz.invalidImport",
    )

  it("rejects a sheet without a single usable question", async () => {
    await reject([HEADERS])
  })

  it("rejects a sheet holding something else entirely", async () => {
    await reject([
      ["Nom", "Service"],
      ["Alex", "La Serre"],
    ])
  })
})
