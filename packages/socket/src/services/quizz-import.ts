// Type-only: the exceljs runtime is loaded lazily in parseQuizzXlsx so the
// server boot does not pay for it.
import type Excel from "exceljs"

/**
 * Parses a quiz spreadsheet (Kahoot export/template compatible) into the
 * quizz payload expected by `quizzValidator`.
 *
 * Two layouts are supported:
 * - a header row containing "Question", "Answer 1..4" (or "Réponse"),
 *   "Time"/"Temps" and "Correct" columns, data on the following rows;
 * - the Kahoot template fixed layout (columns B..H, data from row 9).
 */

const KAHOOT_LAYOUT = {
  headerRow: 8,
  question: 2,
  answers: [3, 4, 5, 6],
  time: 7,
  correct: 8,
}

const MAX_SCAN_ROWS = 30
const DEFAULT_TIME = 20
const MIN_TIME = 5
const MAX_TIME = 120

interface ColumnMap {
  firstDataRow: number
  question: number
  answers: number[]
  time: number | null
  correct: number
}

const cellText = (sheet: Excel.Worksheet, row: number, col: number): string =>
  sheet.getRow(row).getCell(col).text.trim()

const findColumns = (sheet: Excel.Worksheet): ColumnMap | null => {
  const lastScan = Math.min(sheet.rowCount, MAX_SCAN_ROWS)

  for (let r = 1; r <= lastScan; r += 1) {
    // Object properties are used (not locals) so TS does not narrow across
    // the eachCell callback.
    const found: {
      question: number | null
      time: number | null
      correct: number | null
      answers: number[]
    } = { question: null, time: null, correct: null, answers: [] }

    sheet.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => {
      const text = cell.text.trim()

      if (/^question/iu.test(text)) {
        found.question = col
      } else if (/^(answer|réponse|respuesta|antwort|risposta)/iu.test(text)) {
        found.answers.push(col)
      } else if (/time|temps|tiempo|zeit/iu.test(text)) {
        found.time = col
      } else if (/correct/iu.test(text)) {
        found.correct = col
      }
    })

    if (
      found.question !== null &&
      found.answers.length >= 2 &&
      found.correct !== null
    ) {
      return {
        firstDataRow: r + 1,
        question: found.question,
        answers: found.answers.sort((a, b) => a - b),
        time: found.time,
        correct: found.correct,
      }
    }
  }

  return null
}

export const parseQuizzXlsx = async (
  buffer: Buffer,
  subject: string,
): Promise<unknown> => {
  const { default: ExcelJS } = await import("exceljs")
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)

  if (workbook.worksheets.length === 0) {
    throw new Error("errors:quizz.invalidImport")
  }

  const [sheet] = workbook.worksheets

  const columns: ColumnMap = findColumns(sheet) ?? {
    firstDataRow: KAHOOT_LAYOUT.headerRow + 1,
    question: KAHOOT_LAYOUT.question,
    answers: KAHOOT_LAYOUT.answers,
    time: KAHOOT_LAYOUT.time,
    correct: KAHOOT_LAYOUT.correct,
  }

  const questions = []

  for (let r = columns.firstDataRow; r <= sheet.rowCount; r += 1) {
    const questionText = cellText(sheet, r, columns.question)

    if (!questionText) {
      continue
    }

    // "Correct answer(s)" indices are 1-based over the ORIGINAL answer
    // columns: map them before compacting, so a blank cell in the middle
    // cannot shift the correct answers.
    const rawAnswers = columns.answers.map((col) => cellText(sheet, r, col))
    const compact: Array<number | null> = []
    const answers: string[] = []

    for (const text of rawAnswers) {
      if (text === "") {
        compact.push(null)
      } else {
        compact.push(answers.length)
        answers.push(text)
      }
    }

    if (answers.length < 2) {
      continue
    }

    const solutions = [
      ...new Set(
        cellText(sheet, r, columns.correct)
          .split(/[,;]/u)
          .map((part) => Number.parseInt(part, 10))
          .filter(
            (n) => Number.isInteger(n) && n >= 1 && n <= rawAnswers.length,
          )
          .map((n) => compact[n - 1])
          .filter((v): v is number => v !== null),
      ),
    ]

    if (solutions.length === 0) {
      continue
    }

    const rawTime = columns.time
      ? Number.parseInt(cellText(sheet, r, columns.time), 10)
      : Number.NaN

    const time = Number.isNaN(rawTime)
      ? DEFAULT_TIME
      : Math.min(MAX_TIME, Math.max(MIN_TIME, rawTime))

    const multi = solutions.length > 1

    questions.push({
      type: multi ? "multi" : "single",
      question: questionText,
      answers,
      solutions,
      cooldown: 5,
      time,
      ...(multi ? { options: { scoringMode: "strict" } } : {}),
    })
  }

  if (questions.length === 0) {
    throw new Error("errors:quizz.invalidImport")
  }

  return { subject, questions }
}
