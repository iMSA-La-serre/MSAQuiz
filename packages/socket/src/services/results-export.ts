import { QUESTION_TYPES } from "@razzia/common/constants"
import type {
  GameResult,
  PlayerAnswerRecord,
  QuestionResult,
} from "@razzia/common/types/game"
import { isKnownType } from "@razzia/socket/services/scoring"
import {
  hasAnswer,
  isCorrectRecord,
  recordScore,
} from "@razzia/socket/services/stats"
import type Excel from "exceljs"

type AnsweredRecord = PlayerAnswerRecord & { answerIds: number[] }

interface QuestionRows {
  sheet: Excel.Worksheet
  question: QuestionResult
  answered: AnsweredRecord[]
}

// Choice types: one row per answer, the correct ones ticked.
const addChoiceRows = ({ sheet, question, answered }: QuestionRows) => {
  question.answers.forEach((label, answerIndex) => {
    sheet.addRow({
      answer: label,
      correct: question.solutions.includes(answerIndex) ? "✓" : "",
      votes: answered.filter((record) => record.answerIds.includes(answerIndex))
        .length,
    })
  })
}

// Ordering: the items in the correct order, with the players who put each
// one at its place, then the exact orders and the mean score.
const addOrderingRows = ({ sheet, question, answered }: QuestionRows) => {
  sheet.addRow({
    answer: "Éléments dans l'ordre correct",
    votes: "Bien placés",
  }).font = { italic: true }

  question.answers.forEach((label, itemIndex) => {
    sheet.addRow({
      answer: `${itemIndex + 1}. ${label}`,
      votes: answered.filter(
        (record) => record.answerIds[itemIndex] === itemIndex,
      ).length,
    })
  })

  sheet.addRow({
    answer: "Ordres exacts",
    votes: answered.filter((record) => isCorrectRecord(question, record))
      .length,
  })

  const scoreSum = answered.reduce(
    (sum, record) => sum + recordScore(question, record),
    0,
  )
  const meanRow = sheet.addRow({
    answer: "Score moyen",
    votes: answered.length > 0 ? scoreSum / answered.length : null,
  })

  meanRow.getCell("votes").numFmt = "0%"
}

// Shortanswer: the accepted answers with the inputs each one recognized,
// then how many inputs matched none (their text stays out of the report).
const addShortAnswerRows = ({ sheet, question, answered }: QuestionRows) => {
  for (const [acceptedIndex, label] of (question.accepted ?? []).entries()) {
    sheet.addRow({
      answer: label,
      correct: "✓",
      votes: answered.filter((record) =>
        record.answerIds.includes(acceptedIndex),
      ).length,
    })
  }

  sheet.addRow({
    answer: "Non reconnues",
    votes: answered.filter((record) => record.answerIds.length === 0).length,
  })
}

/** Builds an Excel report (ranking + per-question details) for a game result. */
export const buildResultWorkbook = async (
  result: GameResult,
): Promise<Buffer> => {
  // Lazy-loaded: keeps exceljs out of the server boot path.
  const { default: ExcelJS } = await import("exceljs")
  const workbook = new ExcelJS.Workbook()

  const ranking = workbook.addWorksheet("Classement")

  ranking.columns = [
    { header: "Rang", key: "rank", width: 8 },
    { header: "Joueur", key: "username", width: 30 },
    { header: "Points", key: "points", width: 12 },
  ]
  ranking.getRow(1).font = { bold: true }

  for (const player of result.players) {
    ranking.addRow({
      rank: player.rank,
      username: player.username,
      points: player.points,
    })
  }

  const questions = workbook.addWorksheet("Questions")

  questions.columns = [
    { header: "Question", key: "question", width: 50 },
    { header: "Réponse", key: "answer", width: 40 },
    { header: "Correcte", key: "correct", width: 10 },
    { header: "Votes", key: "votes", width: 8 },
  ]
  questions.getRow(1).font = { bold: true }

  const totalPlayers = result.players.length

  for (const [index, question] of result.questions.entries()) {
    // A type this version does not know is left out, numbering unchanged.
    if (!isKnownType(question.type)) {
      continue
    }

    const answered = question.playerAnswers.filter(hasAnswer)

    const titleRow = questions.addRow({
      question: `Q${index + 1} — ${question.question}`,
    })
    titleRow.font = { bold: true }

    const rows = { sheet: questions, question, answered }

    if (question.type === QUESTION_TYPES.ORDERING) {
      addOrderingRows(rows)
    } else if (question.type === QUESTION_TYPES.SHORTANSWER) {
      addShortAnswerRows(rows)
    } else {
      addChoiceRows(rows)
    }

    questions.addRow({
      answer: "Sans réponse",
      votes: totalPlayers - answered.length,
    })
    questions.addRow({})
  }

  // In Node, exceljs already returns a Buffer: no extra copy needed
  // (its declared type is a browser polyfill, hence the double cast).
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer
}

export const exportFilename = (result: GameResult): string => {
  const date = result.date.slice(0, 10)
  const subject = result.subject.replace(/[^\p{L}\p{N} _-]/gu, "").trim()

  return `${subject || "resultat"} - ${date}.xlsx`
}
